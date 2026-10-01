# Research CRM (Netherlands)

A sales-intelligence CRM for one country's research institutions: who they are, who to talk to, which Elsevier and competitor products they hold, and where the openings are.

## Language

### Accounts

**Institution**:
A research-producing organisation tracked by the CRM: a university, medical centre, research institute or NGO.
_Avoid_: Account, org, opp

**Contact**:
A named person at an Institution.
_Avoid_: Lead, person

**Interaction**:
A dated record of a touch with an Institution, such as a call, email or meeting.
_Avoid_: Note, activity, log

**Region**:
The country one CRM instance covers. The Netherlands, Denmark and Belgium each run their own instance over shared tables.
_Avoid_: Country app, tenant

### Selling

**Deal**:
A sales opportunity at an Institution, with a stage, a value and an expected close date.
_Avoid_: Opp, opportunity, pipeline item

**Tender**:
A public procurement notice that an Elsevier product could answer, shown under RFP Opps.
_Avoid_: Opp, RFP, deal

**Product status**:
What is known about whether an Institution holds a given product: yes, no or unverified.
_Avoid_: Subscription flag, matrix cell

### White Space

**White Space target**:
An Institution with no tenancy for a given Elsevier product, listed as somewhere to sell it.
_Avoid_: Opp, white space opp, prospect

**Pin**:
An owner's decision to keep an Institution in the White Space folder whatever its Product status says.
_Avoid_: Move, folder flag

**White Space folder**:
The set of pinned Institutions, taken out of the main Institutions list.
_Avoid_: White Space tab, White Space type

**Removed**:
A White Space target an owner has taken off the list for one product, restorable at any time.
_Avoid_: Deleted, dismissed, hidden
