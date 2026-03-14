# GC Onboarding & Safety — Chunk 1: Content Documents

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Company Safety Manual and Employee Onboarding Workbook as complete, OSHA-compliant, Nevada-specific markdown documents.

**Architecture:** Two standalone markdown files in `docs/safety/` and `docs/hr/`. No app code touched. These are source-of-truth documents — version-controlled, human-readable, printable. Full content is required; section stubs are not acceptable.

**Tech Stack:** Markdown. No dependencies.

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Track 1

**Compliance references:**
- OSHA 29 CFR 1926 (Construction Industry Standards)
- OSHA 29 CFR 1910.1200 (Hazard Communication / GHS)
- NRS Chapter 618 (Nevada Occupational Safety and Health Act)
- NAC Chapter 618 (Nevada OSHA administrative regulations)
- NRS 608.018 (Nevada daily OT law)
- NRS 618.375 (Nevada OSHA incident reporting)
- NRS 618.445 (Employee rights, anti-retaliation)

---

## Chunk 1, Task 1: Company Safety Manual

**Files:**
- Create: `docs/safety/safety-manual.md`

Write the full Safety Manual with complete prose for each section. Not stubs — real, usable policy language a GC superintendent can hand to a worker and that would satisfy an OSHA compliance audit.

- [ ] **Step 1: Create the file with front matter and all 22 sections**

Write `docs/safety/safety-manual.md` with the following structure and full content:

```markdown
# [Company Name] Safety Manual

**Version:** 1.0
**Effective Date:** [Date]
**Approved By:** [Owner Name], Principal

---

> This manual establishes the safety policies and procedures for all work
> performed by [Company Name] and applies to all employees, subcontractors,
> and visitors on any job site under our supervision. Compliance with this
> manual is a condition of employment and site access.

---

## Table of Contents

1. Company Safety Policy Statement
2. Scope and Applicability
3. Roles and Responsibilities
4. Hazard Communication (HazCom)
5. Personal Protective Equipment (PPE)
6. Fall Protection
7. Scaffolding
8. Ladders
9. Excavation and Trenching
10. Electrical Safety
11. Tool and Equipment Safety
12. Heat Illness Prevention
13. Silica and Dust Control
14. Housekeeping and Site Organization
15. Incident Reporting and Investigation
16. Drug and Alcohol Policy
17. Emergency Action Plan
18. Employee Rights and Anti-Retaliation
19. Disciplinary Policy for Safety Violations
20. Safety Training Requirements
21. Subcontractor Safety Requirements
22. Document Control and Manual Updates

---
```

**Section requirements and content guidance:**

**Section 1 — Company Safety Policy Statement**
- Statement of commitment to worker safety as top priority
- Acknowledgment that safety is every person's responsibility on site
- Statement that safety rules will be enforced consistently
- Signature line for owner/principal

**Section 2 — Scope and Applicability**
- Applies to all W-2 employees, 1099 subcontractors, and visitors
- Applies to all job sites, company vehicles, and company facilities
- Subcontractors are responsible for their own employees but must comply with site safety rules
- This manual supplements but does not replace applicable OSHA standards and Nevada state law

**Section 3 — Roles and Responsibilities**
Define safety duties for each role:
- *Owner/Principal:* Provide resources, enforce policy, set the tone
- *Project Superintendent:* Day-to-day site safety enforcement, safety plan implementation, incident reporting, toolbox talks
- *Foreman:* Direct supervision, pre-task hazard identification, PPE enforcement
- *All Workers:* Follow all safety rules, report hazards immediately, refuse unsafe work, use PPE
- *Subcontractors:* Must meet or exceed GC safety standards; GC may remove non-compliant subs

**Section 4 — Hazard Communication (HazCom)**
Per OSHA 29 CFR 1910.1200 (Hazard Communication Standard / GHS):
- Every hazardous chemical used on site requires an SDS (Safety Data Sheet) from the manufacturer
- SDS binder must be maintained on site and accessible to all workers during their shift
- All chemical containers must be labeled per GHS format (pictogram, signal word, hazard/precautionary statements)
- Workers have the right to know about hazardous chemicals they work with
- Training: all workers trained on how to read SDS and understand labels before working with hazardous materials
- Write-in field for SDS binder location at site: ___________________________

**Section 5 — Personal Protective Equipment (PPE)**
General requirements:
- PPE is required when engineering and administrative controls cannot adequately reduce hazard exposure
- Company provides required PPE; workers are responsible for using and maintaining it
- Damaged or worn PPE must be reported and replaced immediately

Required PPE by task:
| Task | Required PPE |
|------|-------------|
| All site work | Hard hat (ANSI Z89.1 Class E), safety glasses (ANSI Z87.1), steel-toed boots |
| Cutting/grinding | Face shield over safety glasses, hearing protection |
| Working at heights | Hard hat, harness with lanyard (when fall protection system in use) |
| Working with chemicals/solvents | Chemical-resistant gloves, eye protection, respirator if ventilation is inadequate |
| Concrete/masonry work | N95 or higher respirator, knee pads |
| Electrical work | Insulated gloves and tools, arc flash protection as required |
| Demolition | Hard hat, safety glasses, dust mask (N95 minimum), hearing protection |

PPE issue log: All PPE issued to an employee must be documented on their PPE Issue Log (maintained in their personnel file).

**Section 6 — Fall Protection**
Per OSHA 29 CFR 1926 Subpart M:
- Fall protection is required for all work at heights of 6 feet or more above a lower level
- Acceptable fall protection systems: guardrail systems, personal fall arrest systems (PFAS), safety net systems
- Guardrails: top rail 42" (±3") above walking surface, midrail at 21", capable of withstanding 200 lbs outward/downward force
- PFAS: full-body harness, deceleration device, anchor point rated for 5,000 lbs per worker; self-retracting lifelines preferred
- Holes and floor openings: must be covered (cover must support twice the weight of employees, equipment, and materials) or guarded with standard guardrail
- Covers must be labeled "HOLE" or "COVER" and secured to prevent accidental displacement
- Ladders used for access to elevated work areas do not satisfy fall protection requirements on the elevated surface
- Superintendent must document fall protection plan for any job with work at 6+ feet

**Section 7 — Scaffolding**
Per OSHA 29 CFR 1926 Subpart L:
- All scaffolding must be erected, moved, dismantled, or altered by a competent person
- Scaffold platforms: fully planked or decked; minimum 18" wide for work platforms
- Load capacity: scaffolds must support at least 4x the intended load
- Guardrails required on all scaffolds 10 feet or higher
- Access: ladders or stair towers provided; cross-braces not to be used as access
- Daily inspection by competent person before each work shift
- Do not use scaffolding during high winds, electrical storms, or icy conditions

**Section 8 — Ladders**
Per OSHA 29 CFR 1926 Subpart X:
- Inspect ladders before each use; remove from service if damaged (tag: DO NOT USE)
- Extension ladders: extend 3 feet above landing surface; secure at top and bottom
- Angle: 4:1 (1 foot out for every 4 feet of height)
- Do not stand on top two rungs of stepladder or top three rungs of extension ladder
- Face the ladder when climbing; maintain three points of contact at all times
- Do not carry tools/materials in hands while climbing — use tool belt or hoist
- One person on a ladder at a time
- Metal ladders prohibited near electrical hazards

**Section 9 — Excavation and Trenching**
Per OSHA 29 CFR 1926 Subpart P:
- All excavations and trenches must be inspected by a competent person before workers enter and after any hazard-affecting event
- Trenches 5 feet or deeper: protective system required (sloping, shoring, or trench box)
- Trenches 20 feet or deeper: system designed by registered professional engineer
- Spoils: minimum 2 feet from trench edge
- Means of egress: ladder or ramp within 25 feet of any worker in a trench 4+ feet deep
- Contact 811 (Call Before You Dig) at least 2 business days before any excavation — required by Nevada law
- Accumulated water in trench: do not enter until water removed and stability confirmed

**Section 10 — Electrical Safety**
Per OSHA 29 CFR 1926 Subpart K:
- All 120V single-phase 15- and 20-amp temporary power must have GFCI protection
- All temporary wiring must be protected from damage; no damaged cords in service
- Lockout/Tagout (LOTO): de-energize all electrical equipment before servicing; lock out energy source; tag with worker name — do not remove another worker's lock
- Maintain clearance from overhead power lines: minimum 10 feet for lines up to 50kV
- Do not assume any line is de-energized; treat all overhead lines as live
- Electrical panel: never block access; keep 3-foot clearance

**Section 11 — Tool and Equipment Safety**
- Inspect all tools before use; remove from service if damaged
- Use tools only for their intended purpose
- Portable grinders: use correct wheel for material; guard must be in place
- Pneumatic tools: use correct hose fittings; never point at a person; disconnect air before changing attachments
- Powder-actuated tools: operator must be trained and licensed per Nevada requirements; always wear face shield
- All power tools must have functioning guards — do not remove or defeat guards
- Compressed gas cylinders: store upright, chained; cap when not in use; store oxygen and fuel gases separately (20 ft or fire wall)

**Section 12 — Heat Illness Prevention**
Per NAC 618 and Nevada OSHA guidance:
- All outdoor work in Nevada is subject to heat illness risk from approximately May through September
- Water: at least 1 quart of cool (50–60°F) water per hour per worker; accessible at no cost
- Shade: sufficient shade to accommodate all workers on rest break simultaneously; shade required when temperature reaches 80°F
- Rest breaks: 10-minute cool-down rest in shade when worker requests; superintendent should not discourage rest
- Acclimatization: new and returning workers should be gradually introduced to heat; limit to 50% of full heat exposure on day 1, increasing over 7–14 days
- Warning signs of heat exhaustion: heavy sweating, weakness, cold/pale/clammy skin, fast/weak pulse, nausea/vomiting
- Warning signs of heat stroke (emergency): high body temperature (103°F+), hot/red/dry skin, rapid/strong pulse, unconsciousness — **call 911 immediately**
- Superintendent must conduct heat illness prevention training at start of each work season
- Never leave a worker alone who shows signs of heat illness

**Section 13 — Silica and Dust Control**
Per OSHA 29 CFR 1926.1153 (Respirable Crystalline Silica in Construction):
- Silica dust is generated by cutting, grinding, drilling, or crushing concrete, masonry, rock, or sand
- Permissible Exposure Limit (PEL): 50 μg/m³ as 8-hour TWA
- Engineering controls first: use water suppression or local exhaust ventilation (LEV) on cutting/grinding equipment
- When engineering controls alone are insufficient: N95 respirator minimum; P100 for heavy exposure
- Designated areas for high-dust work when possible; restrict access
- Wet methods for concrete cutting whenever feasible
- Prohibit dry sweeping of silica-containing dust — use wet methods or HEPA vacuum
- Exposure records maintained per OSHA requirements

**Section 14 — Housekeeping and Site Organization**
- Keep work areas clean and free of debris at all times
- Materials stored off ground where possible; stacked safely to prevent tipping
- All walkways, stairways, and means of egress must be clear at all times
- Electrical cords and hoses routed to prevent tripping hazards
- Waste disposed of in designated containers; flammable/combustible waste removed daily
- Tools returned to storage when not in use
- At end of each workday: sweep, collect debris, secure materials

**Section 15 — Incident Reporting and Investigation**

*What must be reported immediately (call superintendent, then owner):*
- Any fatality
- Any hospitalization
- Any amputation, loss of eye, or inpatient hospitalization of any worker

*OSHA reporting requirements:*
- Fatality: report to OSHA within 8 hours
- Inpatient hospitalization, amputation, or loss of eye: report to OSHA within 24 hours
- Nevada OSHA: call (775) 688-3045 or report at osha.nv.gov (NRS 618.375)

*Internal incident report:*
- All incidents (injuries, near misses, property damage) must be documented on the Incident Report Form within 24 hours
- Incident Report Form located: ___________________________ (also in job site binder)
- Information required: date/time, location, persons involved, description of incident, witnesses, immediate cause, contributing factors, corrective action
- Superintendent and owner review all incident reports
- Recordkeeping: OSHA 300 log maintained by owner; available to workers upon request

*OSHA 300 Log:*
- All work-related injuries and illnesses meeting OSHA recordkeeping criteria must be entered on OSHA 300 Log within 7 calendar days of notification
- OSHA 300A Summary posted February 1 – April 30 each year

**Section 16 — Drug and Alcohol Policy**
- Workers are prohibited from being under the influence of alcohol or any controlled substance while on a job site or in a company vehicle
- Prescription medications that may affect alertness, coordination, or judgment must be disclosed to the superintendent; worker may be reassigned to non-safety-sensitive duties
- Post-incident testing: any worker involved in an on-site incident resulting in injury or significant property damage may be required to submit to drug and alcohol testing
- Violation: first offense — removal from site, documented; second offense — termination
- Nevada is a recreational cannabis state; cannabis use is still prohibited during work hours and on job sites per this policy

**Section 17 — Emergency Action Plan**
- This section contains the company-wide framework. Site-specific emergency information (nearest ER, local emergency numbers, assembly point) is documented on the Project Safety Plan for each job site and posted in the site binder.

*Emergency contacts:*
- 911 for all life-threatening emergencies
- Poison Control: 1-800-222-1222
- Nevada OSHA: (775) 688-3045
- Owner/Principal: [Name] — [Phone]

*Evacuation procedure:*
1. Superintendent calls evacuation ("All clear the site")
2. Workers stop work immediately, leave tools in place
3. Proceed to designated assembly point (documented on Project Safety Plan)
4. Superintendent accounts for all workers
5. Do not re-enter site until superintendent declares all clear

*Fire:*
- Know the location of fire extinguishers on your site
- PASS technique: Pull, Aim, Squeeze, Sweep
- Small, contained fires only — for any doubt, evacuate and call 911
- Never block fire extinguisher access

*Medical emergency:*
1. Call 911; provide site address and cross street
2. Send a worker to the site entrance to flag down EMS
3. Do not move an injured worker unless they are in immediate danger
4. Provide first aid if trained; otherwise keep worker calm and still until EMS arrives
5. Nearest ER and urgent care: see Project Safety Plan for this job site

**Section 18 — Employee Rights and Anti-Retaliation**
Per NRS 618.445:
- Employees have the right to report safety violations without fear of retaliation
- Employees have the right to request an OSHA inspection if they believe a serious hazard exists
- Employees have the right to participate in OSHA inspections
- Employees have the right to see the OSHA 300 Log
- Retaliation against any employee for exercising these rights is strictly prohibited and is a violation of Nevada law
- Report concerns to the owner or directly to Nevada OSHA: (775) 688-3045

**Section 19 — Disciplinary Policy for Safety Violations**
Safety violations will be addressed promptly and consistently:
- *First violation (minor):* Verbal warning, documented in personnel file, retraining required
- *Second violation or first serious violation:* Written warning, documented, possible removal from site
- *Third violation or willful/repeat serious violation:* Termination
- Certain violations may result in immediate termination on first offense: removing fall protection while working at height, tampering with another worker's LOTO lock, working under the influence of drugs or alcohol, willfully disabling a safety device

**Section 20 — Safety Training Requirements**

| Training | Who | When | Documentation |
|----------|-----|------|---------------|
| Company Safety Orientation (this manual) | All W-2 employees | Day 1 of employment | Signed acknowledgment in personnel file |
| OSHA 10-Hour Construction | All W-2 field workers | Prior to independent site work; within 30 days of hire if newly obtaining | Card in personnel file |
| OSHA 30-Hour Construction | Superintendents, Foremen | Prior to assignment to supervisory role | Card in personnel file |
| Heat Illness Prevention | All site workers | Annually, before heat season (by May 1) | Sign-in sheet |
| Toolbox Talks | All site workers | Weekly minimum | Sign-in sheet maintained by superintendent |
| Incident-specific retraining | Involved workers | Following any incident | Documented in incident report |

Note: OSHA 10 requirement applies to W-2 employees. 1099 subcontractors are responsible for their own workers' OSHA training compliance.

**Section 21 — Subcontractor Safety Requirements**
- All subcontractors must comply with OSHA standards and this safety manual while on our job sites
- Before commencing work, subcontractors must provide: certificate of insurance (workers' comp + general liability), evidence of OSHA 10 for all site supervisors, and any required trade licenses
- Subcontractors are responsible for the safety of their own employees
- The GC superintendent has authority to stop work and remove any subcontractor employee who presents a safety hazard or violates site safety rules
- Subcontractors must report any incident on our job site to our superintendent immediately
- Sub-subcontractors (sub-tiers) must meet the same requirements

**Section 22 — Document Control and Manual Updates**
- This manual is reviewed and updated annually at minimum, or when: OSHA standards change, NRS/NAC 618 regulations change, a significant incident reveals a policy gap
- Version number, effective date, and approver documented on the cover page
- All employees must be notified of significant changes and re-sign the acknowledgment
- Current version of this manual is maintained in the company's document system; printed copies are for reference only — always verify you have the current version before relying on a printed copy

---

*By signing the Onboarding Acknowledgment, I confirm I have received, read, and understood this Safety Manual.*

Employee Signature: ___________________________  Date: ___________

Supervisor Signature: ___________________________  Date: ___________
```

- [ ] **Step 2: Verify all 22 sections are present with substantive content**

Open `docs/safety/safety-manual.md` and confirm:
- All 22 section headers exist
- Each section contains policy language (not just a heading)
- All OSHA standard citations are present (1926 Subpart M/L/X/P/K, 1910.1200, 1926.1153)
- All Nevada citations present (NRS 618.375, NRS 618.445, NAC 618)
- Signature block at end

- [ ] **Step 3: Commit**

```bash
git add docs/safety/safety-manual.md
git commit -m "docs: add company safety manual (OSHA 29 CFR 1926 + NRS 618 compliant)"
```

---

## Chunk 1, Task 2: Employee Onboarding Workbook

**Files:**
- Create: `docs/hr/onboarding-workbook.md`

Write the full Onboarding Workbook — complete prose and checklist content a new hire can actually follow.

- [ ] **Step 1: Create the file with all 11 sections**

Write `docs/hr/onboarding-workbook.md` with the following structure and full content:

```markdown
# [Company Name] Employee Onboarding Workbook

**Version:** 1.0
**Effective Date:** [Date]

---

Welcome to [Company Name]. This workbook is your guide through the first steps of employment.
Complete each section in order. Your supervisor will review this with you on your first day.

---

## Table of Contents

1. Welcome Letter
2. Company Overview
3. Employment Classification
4. Compensation and Pay Schedule
5. Work Hours and Scheduling
6. Code of Conduct
7. Safety Acknowledgment
8. New Hire Checklist
9. Training Requirements and Timeline
10. Benefits Overview
11. Acknowledgment and Signature Page

---

## 1. Welcome Letter

[Personalized welcome from owner — tone: direct, warm, grounded. Key messages:
- We do quality work and expect it from everyone
- Safety is non-negotiable
- Ask questions early, not after
- You're building something with us, not just working for us
- Signature block for owner]

---

## 2. Company Overview

**Who we are:**
[Company Name] is a Nevada-licensed general contractor based in [City], Nevada. We specialize in [describe primary project types — residential renovation, commercial tenant improvement, new construction, etc.].

**How we operate:**
We run lean. Every person on our crew is accountable for their work, their safety, and the quality of what we build. We communicate directly, show up on time, and take pride in leaving a job site cleaner than we found it.

**Our standard:**
We build things that last. That means doing it right the first time, flagging problems early, and never cutting corners on safety or quality.

---

## 3. Employment Classification

**Your classification:**
☐ Full-Time W-2 Employee
☐ Part-Time W-2 Employee
☐ Seasonal W-2 Employee
☐ 1099 Independent Contractor

**What this means:**
- W-2 employees: taxes withheld, eligible for workers' compensation, subject to all company policies, required to complete OSHA 10 within 30 days
- 1099 contractors: responsible for own taxes and insurance, must maintain current liability coverage, subject to site safety rules

**At-will employment:**
Employment at [Company Name] is at-will, meaning either party may end the employment relationship at any time, with or without cause, subject to applicable law.

---

## 4. Compensation and Pay Schedule

**Pay frequency:** [Weekly / Bi-weekly — fill in]

**Pay method:** Direct deposit via Gusto
- You must set up your Gusto account and direct deposit before your first pay date
- Instructions: check your email for an invitation from Gusto; complete setup within 48 hours of receiving it

**Overtime:**
Nevada law (NRS 608.018) requires overtime pay at 1.5x your regular rate for:
- Hours worked over 8 in a single workday
- Hours worked over 40 in a single workweek

Note: Nevada daily overtime is in addition to (not instead of) weekly overtime. If you work 10 hours in a day, the last 2 hours are overtime — even if you haven't hit 40 hours for the week.

**Expense reimbursement:**
- Job-related expenses must be pre-approved by your superintendent
- Submit receipts within 5 business days of the expense

---

## 5. Work Hours and Scheduling

**Standard hours:** [Fill in typical start/end time, e.g., 7:00 AM – 3:30 PM]

**Reporting:**
- Be on site and ready to work at your scheduled start time — not pulling up to the parking lot
- If you will be late or absent, contact your superintendent by [time, e.g., 6:00 AM]
- No-call/no-show on two consecutive days may be treated as voluntary resignation

**Weather:**
Outdoor work in Nevada may be affected by extreme heat, high winds, or rare cold/rain events. Your superintendent will make the call on work stoppage. Check your phone if conditions look questionable — don't assume work is cancelled.

---

## 6. Code of Conduct

**On the job site:**
- Professional behavior at all times — profanity directed at coworkers, clients, or subcontractors is not acceptable
- No horseplay; job sites have real hazards
- Personal cell phone use: keep it to breaks; your superintendent has authority to set stricter rules for specific sites or situations
- Treat all clients' property with care; leave it better than you found it

**Social media:**
- Do not post photos or videos from job sites without written permission from your superintendent
- Do not identify clients, addresses, or project details on social media
- [Company Name]'s reputation is built on trust; protect it

**Confidentiality:**
- Client information, pricing, project details, and business processes are confidential
- Do not share with competitors, former employers, or anyone with no legitimate need

**Conflicts of interest:**
- If you are considering working for a competitor or starting a competing business while employed here, disclose it to the owner first

**Zero tolerance:**
The following result in immediate termination on first offense: theft or fraud, violence or threats of violence, harassment or discrimination, working under the influence of alcohol or controlled substances.

---

## 7. Safety Acknowledgment

I acknowledge that I have received a copy of the [Company Name] Safety Manual and have been given the opportunity to review it. I understand that compliance with the Safety Manual is a condition of my employment, that I am responsible for my own safety and the safety of those around me, and that safety violations may result in disciplinary action up to and including termination.

If I have questions about any safety policy, I will ask my superintendent before proceeding with work.

Signature: ___________________________  Date: ___________

Printed Name: ___________________________

---

## 8. New Hire Checklist

Complete all items before your first day on an active job site. Your supervisor will verify completion.

**Documentation (completed with supervisor):**
- [ ] I-9: Employment Eligibility Verification — completed with supervisor; original documents reviewed
- [ ] W-4: Federal Income Tax Withholding — completed and submitted

**Payroll setup:**
- [ ] Gusto account created and direct deposit configured
- [ ] Bank account verified in Gusto

**Emergency information:**
- [ ] Emergency contact 1 on file (name, relationship, phone number) — required
- [ ] Emergency contact 2 on file (optional but strongly encouraged)
- [ ] Home address on file

**Safety certification:**
- [ ] OSHA 10 card on file (copy + photo of card uploaded to HR system)
  - If not yet certified: enrolled in OSHA 10 course; must complete within 30 days of hire
- [ ] OSHA 30 card on file (superintendents and foremen only)

**Company onboarding:**
- [ ] Safety Manual received and acknowledgment signed (Section 7 above)
- [ ] Onboarding Workbook reviewed with supervisor
- [ ] PPE issued and logged (see PPE Issue Log)
- [ ] Company orientation completed with superintendent

**Systems access (if applicable):**
- [ ] Company app/portal access set up

---

## 9. Training Requirements and Timeline

**All W-2 field workers:**

| Training | Deadline | Where to Get It |
|----------|----------|-----------------|
| Company Safety Orientation | Day 1 | Completed with superintendent |
| OSHA 10-Hour Construction | Within 30 days of hire if not already certified | OSHA Outreach Training Program; online or in-person; ~$100–$150 |

**Superintendents and Foremen (in addition to above):**

| Training | Deadline | Where to Get It |
|----------|----------|-----------------|
| OSHA 30-Hour Construction | Before independent site supervision | OSHA Outreach Training Program; online or in-person; ~$200–$300 |

**All workers — recurring:**

| Training | Frequency | Who Conducts It |
|----------|-----------|-----------------|
| Heat Illness Prevention | Annually, before May 1 | Superintendent |
| Toolbox Talks | Weekly minimum | Superintendent |

**Company will cover the cost of OSHA 10 and OSHA 30 for W-2 employees who do not have current certification.** Receipts required. Card must be on file before reimbursement is processed.

---

## 10. Benefits Overview

Benefits are being established as the company grows. Current status:

- **Workers' Compensation:** All W-2 employees are covered. If you are injured on the job, report it to your superintendent immediately.
- **Paid Time Off:** [Fill in as established — e.g., TBD / accrual policy / no PTO in year 1, etc.]
- **Health Insurance:** [Fill in as established — e.g., Not currently offered / Under evaluation for Q3 2026]
- **Holidays:** [Fill in — e.g., New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas Day]

This section will be updated as the company formalizes its benefits program. Changes will be communicated in writing.

---

## 11. Acknowledgment and Signature Page

By signing below, I confirm that:

1. I have received and reviewed the [Company Name] Safety Manual
2. I have received and reviewed this Onboarding Workbook
3. I understand the policies, expectations, and requirements described in both documents
4. I agree to comply with all company policies as a condition of my employment
5. I have had the opportunity to ask questions, and any questions I have have been answered

I understand that this is not a contract of employment and does not alter the at-will nature of my employment.

---

**Employee:**

Printed Name: ___________________________

Signature: ___________________________

Date: ___________________________

Title / Classification: ___________________________

---

**Supervisor / Company Representative:**

Printed Name: ___________________________

Signature: ___________________________

Date: ___________________________

---

*One copy retained in employee personnel file. One copy provided to employee.*
```

- [ ] **Step 2: Verify all 11 sections are present with substantive content**

Open `docs/hr/onboarding-workbook.md` and confirm:
- All 11 sections have content (not just headings)
- New hire checklist (Section 8) matches spec: I-9, W-4, Gusto, emergency contacts, OSHA cert, Safety Manual ack, PPE, orientation
- Safety acknowledgment (Section 7) has signature line
- Nevada OT law citation (NRS 608.018) present in Section 4
- Signature page (Section 11) has both employee and supervisor signature blocks

- [ ] **Step 3: Commit**

```bash
git add docs/hr/onboarding-workbook.md
git commit -m "docs: add employee onboarding workbook"
```

---

## Chunk 1 Complete

Both compliance documents are now version-controlled source-of-truth files. Proceed to Chunk 2 (Schema + Foundation) once these are committed.
