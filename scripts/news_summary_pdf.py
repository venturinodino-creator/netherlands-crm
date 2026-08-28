#!/usr/bin/env python3
"""
news_summary_pdf.py — builds a News Executive Summary PDF straight from
data/news.json (no separate extraction step needed — that file is already
the flat live feed the News page itself reads). A4 portrait.

Page 1 — Executive Summary: a short narrative overview, KPI tiles (total
  live articles + one per category), a category-mix bar chart, and a
  recency chart (how fresh the live feed is).
Page 2+ — Today's Stories: every live article as a compact block (category
  tag, title, up-to-2-sentence summary, source + date), paginated at a
  fixed number of stories per page so the report scales with feed size
  instead of overflowing or truncating silently.

Usage: python3 scripts/news_summary_pdf.py <news.json> <output.pdf>

Also appends a manifest entry to data/news-summary-reports.json, which the
News page's "Summary" button reads to detect when a freshly-triggered
report has finished generating.
"""
import json
import os
import sys
import textwrap
from collections import Counter
from datetime import datetime, timezone

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch

REGION_LABEL = 'Netherlands'
PAGE_SIZE = (8.27, 11.69)  # A4 portrait, inches
STORIES_PER_PAGE = 7

# ── palette — mirrors the app's own colors (see NEWS_CATEGORIES in index.html) ──
INK = '#0f172a'
MUTED = '#64748b'
LINE = '#e2e8f0'
BG_SOFT = '#f8fafc'
ACCENT = '#0891b2'

CATEGORY_COLORS = {
    'ai_adoption': '#1d4ed8',
    'funding': '#059669',
    'policy': '#991b1b',
    'competitor_announcements': '#7c3aed',
}
CATEGORY_LABELS = {
    'ai_adoption': 'AI Development\n& Adoption',
    'funding': 'Funding\nReceived',
    'policy': f'{REGION_LABEL} Research\nPolicy',
    'competitor_announcements': 'Competitor\nAnnouncements',
}
CATEGORY_LABELS_SHORT = {
    'ai_adoption': 'AI Development & Adoption',
    'funding': 'Funding Received',
    'policy': f'{REGION_LABEL} Research Policy',
    'competitor_announcements': 'Competitor Announcements',
}
CATEGORY_ORDER = ['ai_adoption', 'funding', 'policy', 'competitor_announcements']


def draw_header(fig, title, subtitle, page_num, total_pages):
    fig.text(0.06, 0.965, title, fontsize=18, fontweight='bold', color=INK, ha='left', va='top')
    fig.text(0.06, 0.943, subtitle, fontsize=9.5, color=MUTED, ha='left', va='top')
    fig.text(0.94, 0.965, f'Page {page_num} of {total_pages}', fontsize=8.5, color=MUTED, ha='right', va='top')
    fig.add_artist(plt.Line2D([0.06, 0.94], [0.925, 0.925], color=LINE, linewidth=1, transform=fig.transFigure))


def draw_footer(fig, generated_at):
    fig.add_artist(plt.Line2D([0.06, 0.94], [0.035, 0.035], color=LINE, linewidth=1, transform=fig.transFigure))
    fig.text(0.94, 0.014, f'Generated {generated_at}', fontsize=7, color=MUTED, ha='right', va='bottom')
    fig.text(0.06, 0.014, f'Research CRM · {REGION_LABEL} · News Executive Summary', fontsize=7, color=MUTED, ha='left', va='bottom')


def stat_tile(fig, rect, label, value, color):
    ax = fig.add_axes(rect)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
    ax.add_patch(FancyBboxPatch((0.0, 0.0), 1.0, 1.0, boxstyle='round,pad=0,rounding_size=0.08',
                                 linewidth=0, facecolor=BG_SOFT, transform=ax.transAxes, clip_on=False))
    ax.plot([0.025, 0.025], [0.12, 0.88], color=color, linewidth=4, transform=ax.transAxes, solid_capstyle='butt')
    ax.text(0.14, 0.62, str(value), fontsize=20, fontweight='bold', color=INK, transform=ax.transAxes, va='center')
    ax.text(0.14, 0.24, label, fontsize=7.3, fontweight='bold', color=MUTED, transform=ax.transAxes, va='center')


def category_bar_chart(ax, counts):
    # Vertical bars with multi-line x-tick labels underneath, same pattern as
    # the CRM daily summary's bar_chart() — a horizontal-bar version with
    # long category names as outside y-tick labels doesn't leave enough page
    # margin and clips off the left edge.
    ax.set_title('Live Stories by Category', fontsize=10.5, fontweight='bold', color=INK, loc='left', pad=10)
    keys = [k for k in CATEGORY_ORDER if counts.get(k)]
    if not keys:
        ax.text(0.5, 0.5, 'No live stories yet', ha='center', va='center', color=MUTED, fontsize=9, transform=ax.transAxes)
        ax.axis('off')
        return
    vs = [counts[k] for k in keys]
    cs = [CATEGORY_COLORS[k] for k in keys]
    labels = [CATEGORY_LABELS[k] for k in keys]
    bars = ax.bar(range(len(keys)), vs, color=cs, width=0.6, zorder=3)
    ax.set_xticks(range(len(keys)))
    ax.set_xticklabels(labels, fontsize=6.8, color=MUTED)
    for spine in ['top', 'right', 'left']:
        ax.spines[spine].set_visible(False)
    ax.get_yaxis().set_visible(False)
    ax.set_ylim(0, max(vs) * 1.3)
    for b, v in zip(bars, vs):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + max(vs) * 0.03, str(v),
                 ha='center', fontsize=9, fontweight='bold', color=INK)
    ax.tick_params(axis='x', length=0)


def recency_chart(ax, articles):
    ax.set_title('Feed Freshness', fontsize=10.5, fontweight='bold', color=INK, loc='left', pad=10)
    today = datetime.now(timezone.utc).date()
    buckets = Counter()
    for a in articles:
        d = parse_date(a.get('publishedDate') or a.get('foundDate'))
        if d is None:
            buckets['Unknown'] += 1
            continue
        age = (today - d).days
        if age <= 1:
            buckets['Today'] += 1
        elif age <= 3:
            buckets['2-3 days'] += 1
        elif age <= 7:
            buckets['4-7 days'] += 1
        else:
            buckets['8+ days'] += 1
    order = ['Today', '2-3 days', '4-7 days', '8+ days', 'Unknown']
    colors = {'Today': '#059669', '2-3 days': '#0891b2', '4-7 days': '#f59e0b', '8+ days': '#94a3b8', 'Unknown': '#cbd5e1'}
    keys = [k for k in order if buckets.get(k)]
    if not keys:
        ax.text(0.5, 0.5, 'No live stories yet', ha='center', va='center', color=MUTED, fontsize=9, transform=ax.transAxes)
        ax.axis('off')
        return
    vs = [buckets[k] for k in keys]
    cs = [colors[k] for k in keys]
    bars = ax.bar(range(len(keys)), vs, color=cs, width=0.6, zorder=3)
    ax.set_xticks(range(len(keys)))
    ax.set_xticklabels(keys, fontsize=8, color=MUTED)
    for spine in ['top', 'right', 'left']:
        ax.spines[spine].set_visible(False)
    ax.get_yaxis().set_visible(False)
    ax.set_ylim(0, max(vs) * 1.25)
    for b, v in zip(bars, vs):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + max(vs) * 0.03, str(v),
                 ha='center', fontsize=9, fontweight='bold', color=INK)
    ax.tick_params(axis='x', length=0)


def parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def compose_summary(articles, counts, total):
    if total == 0:
        return (f"No stories are currently live in the {REGION_LABEL} research news feed. "
                f"The daily scan runs every morning at 07:00 UTC and can also be triggered manually.")
    parts = [f"{total} stor{'y is' if total == 1 else 'ies are'} currently live in the {REGION_LABEL} research news feed."]
    breakdown = ', '.join(
        f"{counts[k]} {CATEGORY_LABELS_SHORT[k].lower()}" for k in CATEGORY_ORDER if counts.get(k)
    )
    if breakdown:
        parts.append(f"Breakdown: {breakdown}.")
    # Call out the most recent competitor-announcement and policy stories, since
    # those are typically the most actionable for a sales agent scanning quickly.
    comp = [a for a in articles if a.get('category') == 'competitor_announcements']
    if comp:
        top = comp[0]
        who = top.get('institution') or 'A competitor'
        parts.append(f"Most recent competitor signal: {who} — \"{top.get('title', '')}\".")
    policy = [a for a in articles if a.get('category') == 'policy']
    if policy:
        top = policy[0]
        parts.append(f"Most recent policy story: \"{top.get('title', '')}\".")
    return ' '.join(parts)


def wrap_summary(text, width=92, max_lines=2):
    text = (text or '').strip()
    if not text:
        return ['No summary available for this story.']
    lines = textwrap.wrap(text, width=width)[:max_lines]
    if len(lines) == max_lines and len(textwrap.wrap(text, width=width)) > max_lines:
        lines[-1] = lines[-1].rstrip() + '…'
    return lines


def story_block(fig, y, article):
    cat = article.get('category')
    color = CATEGORY_COLORS.get(cat, MUTED)
    label = CATEGORY_LABELS_SHORT.get(cat, article.get('categoryLabel') or 'News')
    date = article.get('publishedDate') or article.get('foundDate') or ''
    source = article.get('sourceName') or ''
    title = article.get('title') or '(untitled)'
    summary_text = article.get('summary') or article.get('elsevierRelevance') or article.get('description') or ''

    fig.text(0.065, y, label.upper(), fontsize=7, fontweight='bold', color=color, ha='left', va='top')
    meta = ' · '.join(x for x in [date, source] if x)
    if meta:
        meta_lines = textwrap.wrap(meta, width=42)
        fig.text(0.94, y, meta_lines[0] if meta_lines else '', fontsize=7, color=MUTED, ha='right', va='top')
    title_lines = textwrap.wrap(title, width=76)[:2]
    ty = y - 0.019
    for line in title_lines:
        fig.text(0.065, ty, line, fontsize=10.5, fontweight='bold', color=INK, ha='left', va='top')
        ty -= 0.018
    for line in wrap_summary(summary_text):
        fig.text(0.065, ty, line, fontsize=8.7, color=MUTED, ha='left', va='top')
        ty -= 0.0155
    return ty - 0.014  # next block's starting y


def build_report(articles, out_path):
    counts = Counter(a.get('category') for a in articles if a.get('category'))
    total = len(articles)
    generated_dt = datetime.now(timezone.utc)
    generated_at = generated_dt.strftime('%d %b %Y, %H:%M UTC')
    summary_text = compose_summary(articles, counts, total)

    story_pages = max(1, -(-len(articles) // STORIES_PER_PAGE)) if articles else 0
    total_pages = 1 + story_pages

    with PdfPages(out_path) as pdf:
        # ── PAGE 1 — EXECUTIVE SUMMARY ──────────────────────────────────
        fig = plt.figure(figsize=PAGE_SIZE)
        draw_header(fig, 'News Executive Summary',
                    f'{REGION_LABEL} Research News · {generated_dt.strftime("%A, %d %B %Y")}', 1, total_pages)

        fig.text(0.06, 0.895, 'Overview', fontsize=10.5, fontweight='bold', color=INK)
        wrapped = textwrap.wrap(summary_text, width=100)
        y = 0.875
        for line in wrapped[:6]:
            fig.text(0.06, y, line, fontsize=9, color=MUTED, va='top')
            y -= 0.020

        tile_y, tile_h, gap = 0.685, 0.075, 0.015
        # 5 tiles total (Live Stories + 4 categories) wrap across 2 rows: 3 + 2.
        tiles = [('Live Stories', total, ACCENT)] + [
            (CATEGORY_LABELS_SHORT[k].replace(' Received', '').replace(f' {REGION_LABEL} ', ' '), counts.get(k, 0), CATEGORY_COLORS[k])
            for k in CATEGORY_ORDER
        ]
        row1, row2 = tiles[:3], tiles[3:]
        tile_w2 = (0.94 - 0.06 - 2 * gap) / 3
        for i, (label, val, col) in enumerate(row1):
            x = 0.06 + i * (tile_w2 + gap)
            stat_tile(fig, [x, tile_y, tile_w2, tile_h], label, val, col)
        tile_y2 = tile_y - tile_h - 0.025
        tile_w3 = (0.94 - 0.06 - (len(row2) - 1) * gap) / max(1, len(row2))
        for i, (label, val, col) in enumerate(row2):
            x = 0.06 + i * (tile_w3 + gap)
            stat_tile(fig, [x, tile_y2, tile_w3, tile_h], label, val, col)

        chart_top = tile_y2 - 0.05
        chart_h = 0.28
        ax_cat = fig.add_axes([0.06, chart_top - chart_h, 0.42, chart_h])
        category_bar_chart(ax_cat, counts)
        ax_fresh = fig.add_axes([0.54, chart_top - chart_h, 0.40, chart_h])
        recency_chart(ax_fresh, articles)

        draw_footer(fig, generated_at)
        pdf.savefig(fig)
        plt.close(fig)

        # ── PAGES 2+ — TODAY'S STORIES ───────────────────────────────────
        sorted_articles = sorted(
            articles,
            key=lambda a: (a.get('publishedDate') or a.get('foundDate') or ''),
            reverse=True,
        )
        for page_idx in range(story_pages):
            page_articles = sorted_articles[page_idx * STORIES_PER_PAGE:(page_idx + 1) * STORIES_PER_PAGE]
            fig = plt.figure(figsize=PAGE_SIZE)
            draw_header(fig, "Today's Stories",
                        f'{REGION_LABEL} Research News — full live feed, most recent first', 2 + page_idx, total_pages)
            y = 0.90
            for article in page_articles:
                y = story_block(fig, y, article)
                y -= 0.006
            draw_footer(fig, generated_at)
            pdf.savefig(fig)
            plt.close(fig)

    return counts, total, summary_text, generated_dt


def update_manifest(report_path, counts, total, summary_text, generated_dt):
    manifest_path = 'data/news-summary-reports.json'
    try:
        manifest = json.load(open(manifest_path))
    except Exception:
        manifest = []
    entry = {
        'id': generated_dt.strftime('%Y%m%dT%H%M%SZ'),
        'date': generated_dt.strftime('%Y-%m-%d'),
        'generatedAt': generated_dt.isoformat(),
        'file': report_path.replace('data/', '', 1) if report_path.startswith('data/') else report_path,
        'summary': summary_text,
        'stats': {'totalStories': total, 'byCategory': dict(counts)},
    }
    manifest.insert(0, entry)

    MAX_REPORTS = 60
    dropped, manifest = manifest[MAX_REPORTS:], manifest[:MAX_REPORTS]
    for old in dropped:
        old_file = old.get('file')
        if not old_file:
            continue
        old_path = os.path.join('data', old_file)
        try:
            if os.path.isfile(old_path):
                os.remove(old_path)
        except OSError:
            pass

    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)


def main():
    if len(sys.argv) != 3:
        print('Usage: python3 news_summary_pdf.py <news.json> <output.pdf>', file=sys.stderr)
        sys.exit(1)
    input_path, out_path = sys.argv[1], sys.argv[2]
    try:
        articles = json.load(open(input_path))
    except Exception:
        articles = []
    if not isinstance(articles, list):
        articles = []
    # Defensive dedup by id — news.json has occasionally carried duplicate
    # entries from a race between overlapping scan runs; a report shouldn't
    # double-count a story.
    seen, deduped = set(), []
    for a in articles:
        aid = a.get('id')
        if aid and aid in seen:
            continue
        if aid:
            seen.add(aid)
        deduped.append(a)
    articles = deduped

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    counts, total, summary_text, generated_dt = build_report(articles, out_path)
    update_manifest(out_path, counts, total, summary_text, generated_dt)
    print(f'Wrote {out_path}')
    print(f'Live stories: {total} · By category: {dict(counts)}')


if __name__ == '__main__':
    main()
