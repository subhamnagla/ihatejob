// A worked sample CV for every profession.
//
// Seeing a good CV in your own field is worth more than any amount of advice
// about CVs in general. Each sample is written to pass the checker: numbers in
// most bullets, no filler phrases, no first person, field-specific evidence.
//
// Specs are terse on purpose - bullets are pipe-separated - so that adding a
// profession stays a small edit rather than a wall of JSON.

import { blankData } from './schema.js';
import { applyProfession, PROFESSIONS } from './professions.js';

/* spec keys:
   n name · h headline · loc location · s summary
   x experience [role, company, city, start, end ('now' = current), 'b1|b2|b3']
   e education   [degree, school, city, start, end, score]
   k skills      [group, 'a, b, c']
   c certs       [name, issuer, year]
   l licences    [name, authority, number, expiry]
   p publications[title, venue, year]
   a achievements['text', ...]
   g languages   ['English|Fluent', ...]
   j projects    [name, tech, link, date, 'b1|b2']                             */

const SAMPLES = {
  'software-engineering': {
    n: 'Ananya Sharma', h: 'Senior Frontend Engineer', loc: 'Bengaluru, India',
    s: 'Frontend engineer with six years building customer-facing products at scale. Focused on React design systems, web performance and taking fuzzy product ideas to shipped features.',
    x: [['Senior Frontend Engineer', 'Zenpay', 'Bengaluru', 'Mar 2022', 'now',
      'Rebuilt the checkout flow in React 18, cutting median load from 4.1s to 1.3s and lifting conversion 8.4%.|Designed a component library now used by six squads and 40+ engineers.|Introduced visual regression tests that caught 30+ UI defects before release.'],
    ['Frontend Engineer', 'Craftly Labs', 'Pune', 'Jul 2019', 'Feb 2022',
      'Shipped the merchant dashboard used daily by 12,000 sellers.|Moved the build from Webpack to Vite, taking CI from 11 minutes to 3.']],
    e: [['B.Tech, Computer Science', 'Delhi Technological University', 'New Delhi', '2015', '2019', 'CGPA 8.7 / 10']],
    k: [['Languages', 'JavaScript, TypeScript, Python, SQL'], ['Frameworks', 'React, Next.js, Node.js, Tailwind CSS'], ['Tooling', 'Vite, Playwright, Docker, GitHub Actions']],
    j: [['Ledgerly', 'React, Node, PostgreSQL', 'github.com/ananya/ledgerly', '2024', 'Open-source bookkeeping app for freelancers, 1.8k GitHub stars.|Handles multi-currency invoicing and GST-ready exports.']],
  },

  'data-analytics': {
    n: 'Vikram Iyer', h: 'Senior Data Scientist', loc: 'Hyderabad, India',
    s: 'Data scientist working on demand forecasting and pricing. Comfortable owning a model from problem framing through to the dashboard the business actually uses.',
    x: [['Senior Data Scientist', 'Kartway Retail', 'Hyderabad', 'Jun 2021', 'now',
      'Built a demand forecast across 240 SKUs that cut stockouts 23% and freed Rs 4.2 crore of working capital.|Replaced a manual pricing sheet with an elasticity model now setting prices for 60% of the catalogue.|Cut model retraining time from 9 hours to 40 minutes by moving the pipeline to Airflow and Spark.'],
    ['Data Analyst', 'Finlytics', 'Chennai', 'Aug 2018', 'May 2021',
      'Segmented 1.4M customers into eight cohorts, raising campaign response from 1.9% to 4.6%.|Automated a weekly report that had taken two analysts three days each week.']],
    e: [['M.Sc, Statistics', 'University of Hyderabad', 'Hyderabad', '2016', '2018', 'CGPA 9.1 / 10']],
    k: [['Languages', 'Python, R, SQL, Scala'], ['ML', 'scikit-learn, XGBoost, PyTorch, Prophet'], ['Platforms', 'Airflow, Spark, dbt, Snowflake, Tableau']],
    j: [['Retail demand benchmark', 'Python, Prophet', '', '2023', 'Open benchmark comparing six forecasting methods on 3 years of Indian retail data.']],
  },

  'product-management': {
    n: 'Meera Krishnan', h: 'Senior Product Manager', loc: 'Bengaluru, India',
    s: 'Product manager for payments and onboarding surfaces. Six years turning support tickets and funnel data into shipped changes, mostly in fintech.',
    x: [['Senior Product Manager', 'Payglow', 'Bengaluru', 'Jan 2022', 'now',
      'Rebuilt merchant onboarding, cutting time-to-first-transaction from 6 days to 9 hours and raising activation 31%.|Killed three features with under 2% usage, freeing a squad for a year of higher-value work.|Ran the pricing change that lifted ARPU 14% with no measurable churn increase.'],
    ['Product Manager', 'Shoply', 'Bengaluru', 'Mar 2019', 'Dec 2021',
      'Owned the seller app through growth from 4,000 to 26,000 monthly actives.|Introduced weekly customer calls that reshaped two quarters of roadmap.']],
    e: [['MBA', 'IIM Kozhikode', 'Kozhikode', '2017', '2019', ''], ['B.E, Electronics', 'Anna University', 'Chennai', '2012', '2016', '']],
    k: [['Product', 'Discovery, roadmapping, pricing, experimentation'], ['Data', 'SQL, Amplitude, Mixpanel, Looker'], ['Delivery', 'Jira, Figma, A/B testing']],
  },

  design: {
    n: 'Rhea Kapoor', h: 'Senior Product Designer', loc: 'Mumbai, India',
    s: 'Product designer working on complex internal tools and consumer onboarding. Research-led, comfortable shipping in code review alongside engineers.',
    x: [['Senior Product Designer', 'Lumen Health', 'Mumbai', 'Apr 2022', 'now',
      'Redesigned the clinician dashboard, cutting average charting time from 11 minutes to 4.|Built and maintains a 60-component design system adopted by three product teams.|Ran 40+ usability sessions with clinicians, changing the triage flow twice on the evidence.'],
    ['Product Designer', 'Bright Bazaar', 'Pune', 'Jun 2019', 'Mar 2022',
      'Reduced checkout drop-off from 38% to 24% across four rounds of testing.|Introduced an accessibility audit that fixed 90+ WCAG issues before launch.']],
    e: [['B.Des, Communication Design', 'NID Ahmedabad', 'Ahmedabad', '2015', '2019', '']],
    k: [['Design', 'Interaction design, design systems, prototyping'], ['Research', 'Usability testing, contextual enquiry, surveys'], ['Tools', 'Figma, Framer, Principle, Maze']],
    j: [['Clinician dashboard case study', 'Figma, React', 'rheakapoor.design/lumen', '2024', 'Full case study covering research, three design rounds and measured outcome.']],
  },

  marketing: {
    n: 'Arjun Desai', h: 'Growth Marketing Manager', loc: 'Bengaluru, India',
    s: 'Performance and lifecycle marketer for B2B SaaS. Owns the number rather than the campaign calendar.',
    x: [['Growth Marketing Manager', 'Trackly', 'Bengaluru', 'Feb 2022', 'now',
      'Grew inbound pipeline from Rs 2.1 crore to Rs 7.8 crore annually while holding CAC flat.|Cut paid CAC 34% by rebuilding audience segmentation and killing three underperforming channels.|Took organic traffic from 18k to 94k monthly sessions in 14 months.'],
    ['Marketing Executive', 'Nestwork', 'Mumbai', 'Jul 2019', 'Jan 2022',
      'Ran a lifecycle email programme lifting trial-to-paid conversion from 6% to 11%.|Managed a Rs 40 lakh annual paid budget across Google and LinkedIn.']],
    e: [['BBA, Marketing', 'Symbiosis, Pune', 'Pune', '2016', '2019', '']],
    k: [['Channels', 'SEO, Google Ads, LinkedIn Ads, lifecycle email'], ['Analytics', 'GA4, Mixpanel, SQL, Looker Studio'], ['Tools', 'HubSpot, Webflow, Ahrefs, Customer.io']],
  },

  'sales-bd': {
    n: 'Karan Mehta', h: 'Enterprise Account Executive', loc: 'Gurugram, India',
    s: 'Enterprise seller in SaaS, carrying a Rs 6 crore annual quota across BFSI and manufacturing accounts in North India.',
    x: [['Enterprise Account Executive', 'Corevault', 'Gurugram', 'Apr 2021', 'now',
      'Closed 142% of a Rs 6 crore quota in FY24, ranked 2nd of 31 across APAC.|Opened 9 new logos including two of the top five private banks in India.|Grew average deal size from Rs 18 lakh to Rs 41 lakh by shifting from single-team to platform deals.'],
    ['Account Manager', 'Softbridge', 'Noida', 'Jun 2018', 'Mar 2021',
      'Exceeded quota in 10 of 12 quarters, averaging 118% attainment.|Retained 96% of a 40-account book through a price increase.']],
    e: [['BBA', 'Delhi University', 'New Delhi', '2014', '2017', '']],
    k: [['Sales', 'MEDDIC, enterprise negotiation, land-and-expand'], ['Tools', 'Salesforce, Outreach, Gong, LinkedIn Sales Navigator']],
    a: ['President\'s Club 2023 and 2024 - top 5% of global sales force.', 'Highest single deal in company history: Rs 2.3 crore, 2023.'],
  },

  'finance-accounting': {
    n: 'Priya Nair', h: 'Chartered Accountant - Financial Controller', loc: 'Mumbai, India',
    s: 'Chartered Accountant with eight years in controllership and statutory audit across manufacturing and SaaS, including two IFRS transitions.',
    x: [['Financial Controller', 'Arcline Manufacturing', 'Mumbai', 'Jul 2021', 'now',
      'Owns monthly close for a Rs 480 crore turnover entity, cutting close from 12 days to 5.|Led the Ind AS 116 transition across 34 leases with no audit adjustments.|Identified Rs 3.1 crore of recoverable input tax credit missed in prior years.'],
    ['Assistant Manager - Audit', 'S. R. Batliboi & Co.', 'Mumbai', 'Sep 2016', 'Jun 2021',
      'Led statutory audits for eight listed clients with turnover between Rs 200 and 900 crore.|Supervised teams of up to six across concurrent engagements.']],
    e: [['B.Com', 'Narsee Monjee College', 'Mumbai', '2011', '2014', '78%']],
    c: [['Chartered Accountant (CA)', 'ICAI', '2016'], ['CFA Level II', 'CFA Institute', '2019']],
    k: [['Technical', 'Ind AS, IFRS, GST, transfer pricing, consolidation'], ['Systems', 'SAP FICO, Oracle NetSuite, Tally, Advanced Excel']],
  },

  consulting: {
    n: 'Nikhil Rao', h: 'Engagement Manager - Strategy', loc: 'Gurugram, India',
    s: 'Strategy consultant focused on cost transformation and go-to-market for industrials and retail clients across India and South-East Asia.',
    x: [['Engagement Manager', 'Meridian Partners', 'Gurugram', 'Aug 2021', 'now',
      'Led a cost programme for a Rs 3,200 crore auto supplier, identifying Rs 210 crore of annual savings, 62% implemented within a year.|Ran market entry for a European retailer, sizing 14 cities and shaping a 40-store plan.|Manages teams of four to six consultants across concurrent engagements.'],
    ['Consultant', 'Meridian Partners', 'Mumbai', 'Jul 2018', 'Jul 2021',
      'Built the operating model for a bank merger covering 1,100 branches.|Delivered pricing analysis that raised a client\'s gross margin 3.4 points.']],
    e: [['MBA', 'Indian School of Business', 'Hyderabad', '2016', '2018', 'Dean\'s List'], ['B.Tech, Mechanical', 'IIT Bombay', 'Mumbai', '2011', '2015', 'CGPA 8.9 / 10']],
    k: [['Consulting', 'Cost transformation, market entry, operating model design'], ['Analysis', 'Financial modelling, SQL, Alteryx, Tableau']],
  },

  'healthcare-clinical': {
    n: 'Sneha Pillai', h: 'Registered Nurse - Critical Care', loc: 'Kochi, India',
    s: 'Critical care nurse with seven years in tertiary ICU settings, experienced in ventilator management, CRRT and rapid response.',
    x: [['Senior Staff Nurse - Medical ICU', 'Amrita Institute of Medical Sciences', 'Kochi', 'Mar 2020', 'now',
      'Manages a 3:1 patient ratio in a 24-bed medical ICU with acuity scores averaging 22 (APACHE II).|Precepts four new graduate nurses per year, all retained beyond 18 months.|Led a line-care audit that cut CLABSI rate from 2.4 to 0.7 per 1,000 line days.'],
    ['Staff Nurse', 'Lakeshore Hospital', 'Kochi', 'Jun 2017', 'Feb 2020',
      'Rotated across post-surgical and emergency wards averaging 38 admissions per shift.|Completed 240 hours of ventilator and haemodynamic monitoring training.']],
    e: [['B.Sc Nursing', 'Rajagiri College of Nursing', 'Kochi', '2013', '2017', '81%']],
    l: [['Registered Nurse and Registered Midwife', 'Kerala Nurses and Midwives Council', 'KNMC/2017/18442', 'Aug 2027']],
    c: [['BLS Provider', 'American Heart Association', '2024'], ['ACLS Provider', 'American Heart Association', '2024']],
    k: [['Clinical', 'Ventilator management, CRRT, ABG interpretation, central lines'], ['Systems', 'Cerner, iCU charting, NABH documentation']],
  },

  law: {
    n: 'Aditya Bhandari', h: 'Senior Associate - Corporate Law', loc: 'Mumbai, India',
    s: 'Corporate lawyer with six years in M&A and private equity transactions, including cross-border deals in the technology and healthcare sectors.',
    x: [['Senior Associate', 'Khaitan Chambers', 'Mumbai', 'May 2021', 'now',
      'Advised on 14 M&A transactions with an aggregate value above Rs 4,800 crore.|Led due diligence teams of up to five associates on deals up to Rs 900 crore.|Drafted and negotiated share purchase and shareholder agreements across 11 completed deals.'],
    ['Associate', 'Vantage Legal', 'New Delhi', 'Aug 2018', 'Apr 2021',
      'Handled 30+ private equity investments in the Series A to Series C range.|Appeared before NCLT in six insolvency matters as part of the instructed team.']],
    e: [['B.A. LL.B. (Hons.)', 'NALSAR University of Law', 'Hyderabad', '2013', '2018', 'Rank 4 of 120']],
    l: [['Advocate', 'Bar Council of Maharashtra & Goa', 'MAH/4471/2018', '']],
    k: [['Practice areas', 'M&A, private equity, corporate governance, insolvency'], ['Drafting', 'SPA, SHA, term sheets, due diligence reports']],
    p: [['Bhandari, A. (2023). Control premiums in Indian minority investments.', 'National Law Review', '2023']],
  },

  'teaching-education': {
    n: 'Lakshmi Venkatesh', h: 'Secondary Mathematics Teacher', loc: 'Chennai, India',
    s: 'CBSE mathematics teacher with nine years across grades 9 to 12, including four years as department coordinator.',
    x: [['Head of Mathematics', 'Vidya Mandir Senior Secondary', 'Chennai', 'Jun 2020', 'now',
      'Raised grade 12 board averages from 74% to 88% over three cohorts of roughly 180 students.|Leads a department of seven teachers and set the current grades 9 to 12 scheme of work.|Introduced weekly diagnostic testing that cut the bottom-quartile failure rate from 14% to 3%.'],
    ['Mathematics Teacher', 'St. Anne\'s Matriculation School', 'Chennai', 'Jun 2015', 'May 2020',
      'Taught grades 9 to 12, averaging 34 students per class across five sections.|Ran a remedial programme that moved 41 students from failing to passing grades.']],
    e: [['M.Sc Mathematics', 'University of Madras', 'Chennai', '2011', '2013', '76%'], ['B.Ed', 'Tamil Nadu Teachers Education University', 'Chennai', '2013', '2014', '81%']],
    l: [['Trained Graduate Teacher (TGT) certification', 'Tamil Nadu Teachers Recruitment Board', 'TN/TGT/2014/8821', '']],
    k: [['Teaching', 'CBSE and state board curricula, differentiated instruction, assessment design'], ['Digital', 'Google Classroom, GeoGebra, Desmos']],
  },

  'core-engineering': {
    n: 'Rohan Deshpande', h: 'Mechanical Design Engineer', loc: 'Pune, India',
    s: 'Mechanical engineer in automotive component design, working across concept, DFMEA and production release for sheet metal and cast assemblies.',
    x: [['Senior Design Engineer', 'Bharat Forge', 'Pune', 'Sep 2020', 'now',
      'Owns design for a front axle assembly family shipping 180,000 units a year.|Cut component weight 11% while holding fatigue life, saving Rs 2.4 crore in annual material cost.|Reduced warranty returns on one variant from 1.8% to 0.4% after a root-cause redesign.'],
    ['Design Engineer', 'Endurance Technologies', 'Aurangabad', 'Jul 2017', 'Aug 2020',
      'Released 40+ production drawings to IS and ISO tolerancing standards.|Ran DFMEA workshops for six new component introductions.']],
    e: [['B.E, Mechanical Engineering', 'College of Engineering Pune', 'Pune', '2013', '2017', '73%']],
    k: [['CAD/CAE', 'SolidWorks, CATIA V5, ANSYS, GD&T (ASME Y14.5)'], ['Process', 'DFMEA, APQP, PPAP, root cause analysis']],
    j: [['Lightweight axle housing', 'CATIA, ANSYS', '', '2023', 'Topology-optimised housing, 11% lighter at equal fatigue life, now in production.']],
  },

  'operations-supply': {
    n: 'Sanjay Kulkarni', h: 'Supply Chain Manager', loc: 'Nashik, India',
    s: 'Supply chain manager covering planning, warehousing and transport for FMCG distribution across western India.',
    x: [['Supply Chain Manager', 'Freshline Foods', 'Nashik', 'Jan 2021', 'now',
      'Runs a network of 4 warehouses and 62 routes serving 3,400 retail outlets.|Raised on-time-in-full from 82% to 96% in 18 months.|Cut cost per case from Rs 14.20 to Rs 10.80 by reworking route density and renegotiating three carrier contracts.'],
    ['Logistics Executive', 'Marico', 'Mumbai', 'Aug 2017', 'Dec 2020',
      'Managed inbound scheduling for 900+ SKUs across two plants.|Reduced inventory days from 46 to 31 without affecting fill rate.']],
    e: [['MBA, Operations', 'Symbiosis Institute of Operations Management', 'Nashik', '2015', '2017', '']],
    c: [['Certified Supply Chain Professional (CSCP)', 'ASCM', '2022']],
    k: [['Planning', 'S&OP, demand planning, inventory optimisation'], ['Systems', 'SAP MM/SD, WMS, Advanced Excel, Power BI']],
  },

  'human-resources': {
    n: 'Divya Menon', h: 'HR Business Partner', loc: 'Bengaluru, India',
    s: 'HR business partner supporting engineering and product functions, with a focus on hiring quality and first-year retention.',
    x: [['HR Business Partner', 'Zentrix Systems', 'Bengaluru', 'Mar 2021', 'now',
      'Supports 320 employees across engineering and product.|Cut regretted first-year attrition from 19% to 8% by reworking onboarding and manager check-ins.|Reduced time to hire from 54 days to 31 while raising offer acceptance from 68% to 87%.'],
    ['Talent Acquisition Lead', 'Innovate Labs', 'Bengaluru', 'Jun 2018', 'Feb 2021',
      'Hired 140 engineers in three years across a team of four recruiters.|Built the structured interview kit still used across the company.']],
    e: [['MBA, Human Resources', 'XLRI Jamshedpur', 'Jamshedpur', '2016', '2018', '']],
    k: [['HR', 'Business partnering, performance management, compensation review'], ['Systems', 'Workday, Greenhouse, Darwinbox, Excel']],
  },

  'academic-research': {
    n: 'Dr. Kavita Ramesh', h: 'Postdoctoral Researcher - Computational Neuroscience', loc: 'Bengaluru, India',
    s: 'Computational neuroscientist working on network models of memory consolidation, with a focus on hippocampal replay in rodent recordings.',
    x: [['Postdoctoral Researcher', 'National Centre for Biological Sciences', 'Bengaluru', 'Sep 2022', 'now',
      'Leads a project on replay dynamics across 40 recording sessions in freely moving rodents.|Supervises two PhD students and one masters student.|Maintains the laboratory analysis pipeline used by nine researchers.'],
    ['Visiting Researcher', 'University of Edinburgh', 'Edinburgh, UK', 'Jan 2022', 'Aug 2022',
      'Collaborated on a cross-species comparison of sequence replay, resulting in one publication.']],
    e: [['PhD, Computational Neuroscience', 'Indian Institute of Science', 'Bengaluru', '2017', '2022', 'Thesis: Sequence replay and memory consolidation'], ['M.Sc, Physics', 'IIT Madras', 'Chennai', '2015', '2017', 'CGPA 9.3 / 10']],
    p: [['Ramesh, K., Iyer, S., & Rao, M. (2024). Replay fidelity predicts consolidation strength in rodent hippocampus.', 'Nature Neuroscience', '2024'],
      ['Ramesh, K., & Rao, M. (2023). A spiking network model of sharp-wave ripple generation.', 'PLOS Computational Biology', '2023'],
      ['Ramesh, K. et al. (2022). Open tools for replay detection in electrophysiology.', 'Journal of Open Source Software', '2022']],
    a: ['DBT/Wellcome India Alliance Early Career Fellowship, Rs 1.2 crore, 2024.', 'Best poster, Society for Neuroscience annual meeting, 2023.'],
    k: [['Methods', 'Spiking network models, Bayesian decoding, spectral analysis'], ['Computing', 'Python, MATLAB, C++, HPC clusters, Git']],
  },

  'student-fresher': {
    n: 'Aarav Gupta', h: 'Final-year Computer Science student seeking a software engineering role', loc: 'Bhopal, India',
    s: 'Final-year B.Tech student with internship experience in backend development and three shipped side projects. Looking for a graduate software engineering role.',
    x: [['Software Engineering Intern', 'Cloudpine', 'Remote', 'May 2024', 'Jul 2024',
      'Built three REST endpoints now serving 20,000 requests a day in production.|Wrote the test suite for the billing module, taking coverage from 41% to 78%.'],
    ['Teaching Assistant - Data Structures', 'MANIT Bhopal', 'Bhopal', 'Aug 2023', 'Apr 2024',
      'Ran weekly lab sessions for 60 second-year students.']],
    e: [['B.Tech, Computer Science', 'MANIT Bhopal', 'Bhopal', '2021', '2025', 'CGPA 8.4 / 10']],
    j: [['Campus Mess Tracker', 'React Native, Firebase', 'github.com/aaravg/mess-tracker', '2024', 'Attendance and billing app used by 800 students in two hostels.|Cut monthly billing disputes from around 30 to 4.'],
      ['Devlog CLI', 'Go', 'github.com/aaravg/devlog', '2023', 'Command-line work journal with 320 GitHub stars.']],
    k: [['Languages', 'Java, Python, JavaScript, Go, SQL'], ['Frameworks', 'Spring Boot, React, Node.js'], ['Tools', 'Git, Docker, PostgreSQL, Linux']],
    a: ['Winner, Smart India Hackathon 2024 - rural logistics tracker, chosen from 1,200 teams.', 'Solved 600+ problems on LeetCode; Knight badge.'],
  },

  'government-psu': {
    n: 'Ramesh Chandra Yadav', h: 'Assistant Engineer (Civil) - Public Works Department', loc: 'Lucknow, Uttar Pradesh',
    s: 'Assistant Engineer with eleven years in road and building works under the state PWD, including supervision of works up to Rs 40 crore in value.',
    x: [['Assistant Engineer (Civil)', 'Public Works Department, Government of Uttar Pradesh', 'Lucknow', 'Jul 2017', 'now',
      'Supervises road works across two divisions covering 340 km of state highway.|Executed 18 works totalling Rs 41.6 crore, all completed within sanctioned cost.|Supervises a field staff of 14 including junior engineers and work agents.'],
    ['Junior Engineer (Civil)', 'Public Works Department, Government of Uttar Pradesh', 'Gorakhpur', 'Aug 2013', 'Jun 2017',
      'Prepared estimates and measurement books for 60+ works.|Conducted quality testing as per IRC and MoRTH specifications.']],
    e: [['B.Tech, Civil Engineering', 'Madan Mohan Malaviya University of Technology', 'Gorakhpur', '2009', '2013', '72%, First Division'],
      ['Intermediate (Science)', 'U.P. Board', 'Gorakhpur', '2005', '2007', '68%, First Division']],
    k: [['Technical', 'Estimation, quality control, IRC and MoRTH specifications, AutoCAD'], ['Administrative', 'e-Tendering (GeM), measurement books, departmental audit']],
    a: ['Commendation from Chief Engineer for completing flood-damage restoration in 21 days, 2021.'],
    g: ['Hindi|Native', 'English|Fluent'],
  },

  cybersecurity: {
    n: 'Farhan Qureshi', h: 'Security Engineer - Detection & Response', loc: 'Bengaluru, India',
    s: 'Security engineer working on detection engineering and incident response across a 9,000-endpoint estate, with a background in offensive testing.',
    x: [['Security Engineer', 'Northgate Financial', 'Bengaluru', 'Feb 2022', 'now',
      'Cut mean time to detect from 4.2 hours to 22 minutes by rewriting 60+ Sigma detection rules.|Led response on 14 confirmed incidents including one ransomware attempt contained before encryption.|Reduced phishing simulation click rate from 24% to 6% across 9,000 staff in four campaigns.'],
    ['Penetration Tester', 'Redcell Security', 'Pune', 'Jul 2019', 'Jan 2022',
      'Delivered 45+ web and network assessments for BFSI clients.|Credited with three CVEs in commercial products.']],
    e: [['B.Tech, Information Technology', 'VIT Vellore', 'Vellore', '2015', '2019', 'CGPA 8.2 / 10']],
    c: [['Offensive Security Certified Professional (OSCP)', 'OffSec', '2021'], ['CISSP', 'ISC2', '2024']],
    k: [['Detection', 'Sigma, Splunk, Elastic, MITRE ATT&CK, threat hunting'], ['Offensive', 'Burp Suite, Metasploit, Nmap, Active Directory attacks'], ['Cloud', 'AWS security, Terraform, container hardening']],
  },

  'it-support': {
    n: 'Neha Joshi', h: 'IT Support Specialist', loc: 'Pune, India',
    s: 'IT support specialist supporting 600 users across two offices, covering endpoint management, identity and first-line network issues.',
    x: [['IT Support Specialist', 'Meridian Services', 'Pune', 'Apr 2021', 'now',
      'Handles roughly 45 tickets a week with a first-call resolution rate of 78%.|Cut average resolution time from 9 hours to 3.5 by rewriting the triage runbook.|Rolled out Intune to 600 endpoints with no unplanned downtime.'],
    ['Desktop Support Engineer', 'Infotech Solutions', 'Pune', 'Jun 2018', 'Mar 2021',
      'Supported 250 users across Windows and macOS.|Maintained 99.6% uptime on 12 branch office links.']],
    e: [['B.Sc, Computer Science', 'Savitribai Phule Pune University', 'Pune', '2015', '2018', '68%']],
    c: [['Microsoft 365 Certified: Modern Desktop Administrator', 'Microsoft', '2022'], ['CompTIA Network+', 'CompTIA', '2020']],
    k: [['Endpoint', 'Windows 11, macOS, Intune, Active Directory, Entra ID'], ['Network', 'TCP/IP, VPN, DNS, DHCP, basic Cisco'], ['Service', 'ServiceNow, Jira Service Management, ITIL v4']],
  },

  architecture: {
    n: 'Ishaan Verma', h: 'Project Architect', loc: 'New Delhi, India',
    s: 'Architect with seven years across institutional and residential projects, working from concept through construction documentation and site coordination.',
    x: [['Project Architect', 'Studio Anand', 'New Delhi', 'Mar 2021', 'now',
      'Led design and delivery of a 14,000 sq m campus building completed on a Rs 62 crore budget.|Coordinates a consultant team of nine across structure, MEP and landscape.|Cut construction documentation errors 40% by introducing a Revit template and model audit.'],
    ['Architect', 'Morphogenesis', 'New Delhi', 'Jul 2017', 'Feb 2021',
      'Worked on four residential projects totalling 320 units.|Produced GFC drawing sets for two projects above 8,000 sq m.']],
    e: [['B.Arch', 'School of Planning and Architecture', 'New Delhi', '2012', '2017', '74%']],
    l: [['Registered Architect', 'Council of Architecture, India', 'CA/2017/104882', '']],
    k: [['Software', 'Revit, AutoCAD, Rhino, SketchUp, Enscape'], ['Technical', 'NBC 2016, GRIHA, construction detailing, tender documentation']],
    j: [['Ashoka Campus Block C', 'Revit, Enscape', 'ishaanverma.com/ashoka', '2024', '14,000 sq m academic building, Rs 62 crore, completed 2024.|GRIHA 4-star rated.']],
  },

  agriculture: {
    n: 'Manjunath Gowda', h: 'Agronomist - Farm Advisory', loc: 'Belagavi, Karnataka',
    s: 'Agronomist working with smallholder sugarcane and maize farmers on yield improvement and input efficiency across northern Karnataka.',
    x: [['Senior Agronomist', 'Krishi Sahayak Agri Services', 'Belagavi', 'Jun 2020', 'now',
      'Advises 1,800 farmers across 6,400 acres in four talukas.|Raised average sugarcane yield from 38 to 47 tonnes per acre over three seasons.|Cut fertiliser cost per acre 18% through soil-test-based nutrient plans.'],
    ['Field Officer', 'Rallis India', 'Hubballi', 'Aug 2017', 'May 2020',
      'Ran 60+ demonstration plots across maize and cotton.|Trained 900 farmers on integrated pest management.']],
    e: [['M.Sc, Agronomy', 'University of Agricultural Sciences, Dharwad', 'Dharwad', '2015', '2017', 'CGPA 8.1 / 10'],
      ['B.Sc, Agriculture', 'University of Agricultural Sciences, Dharwad', 'Dharwad', '2011', '2015', '76%']],
    k: [['Agronomy', 'Soil testing, nutrient management, IPM, irrigation scheduling'], ['Field', 'Trial design, farmer training, FPO liaison']],
    g: ['Kannada|Native', 'Hindi|Fluent', 'English|Advanced'],
  },

  pharmacy: {
    n: 'Anjali Bhatt', h: 'Clinical Pharmacist', loc: 'Ahmedabad, India',
    s: 'Hospital pharmacist covering inpatient dispensing, medication reconciliation and antimicrobial stewardship in a 450-bed tertiary hospital.',
    x: [['Clinical Pharmacist', 'Sterling Hospital', 'Ahmedabad', 'Aug 2020', 'now',
      'Reviews around 120 prescriptions daily across four inpatient wards.|Medication reconciliation on admission cut discrepancy rate from 18% to 5%.|Antimicrobial stewardship rounds reduced restricted antibiotic days of therapy 22%.'],
    ['Pharmacist', 'Apollo Pharmacy', 'Vadodara', 'Jul 2018', 'Jul 2020',
      'Dispensed roughly 200 prescriptions per shift with zero reported dispensing errors.|Counselled patients on chronic therapy adherence across 30+ conditions.']],
    e: [['Pharm.D', 'Nirma University', 'Ahmedabad', '2012', '2018', '74%']],
    l: [['Registered Pharmacist', 'Gujarat State Pharmacy Council', 'GSPC/2018/22317', 'Mar 2028']],
    k: [['Clinical', 'Medication reconciliation, TDM, antimicrobial stewardship, ADR reporting'], ['Systems', 'Hospital HIS, NABH documentation']],
  },

  dentistry: {
    n: 'Dr. Rajat Malhotra', h: 'General Dentist', loc: 'Chandigarh, India',
    s: 'General dentist with six years in private practice, comfortable across restorative, endodontic and minor surgical procedures.',
    x: [['Associate Dentist', 'Smilecare Dental Clinic', 'Chandigarh', 'Feb 2020', 'now',
      'Handles around 90 cases per month across restorative, endodontic and prosthetic work.|Completed 400+ root canal treatments with a reported retreatment rate under 3%.|Introduced a recall system that lifted six-month return visits from 34% to 61%.'],
    ['Junior Dentist', 'Dental Care Centre', 'Ludhiana', 'Aug 2018', 'Jan 2020',
      'Performed 600+ restorations and 250 extractions under supervision.']],
    e: [['BDS', 'Government Dental College', 'Amritsar', '2013', '2018', '71%']],
    l: [['Registered Dental Surgeon', 'Punjab State Dental Council', 'PSDC/A-9921', 'Dec 2027']],
    k: [['Clinical', 'Endodontics, restorative dentistry, extractions, crown and bridge'], ['Equipment', 'RVG, apex locator, rotary endodontics']],
  },

  physiotherapy: {
    n: 'Sneha Wagh', h: 'Musculoskeletal Physiotherapist', loc: 'Pune, India',
    s: 'Physiotherapist specialising in musculoskeletal and sports rehabilitation, with five years of outpatient caseload experience.',
    x: [['Senior Physiotherapist', 'Sancheti Institute', 'Pune', 'Jun 2021', 'now',
      'Carries an outpatient caseload of 14 to 18 patients daily across post-operative and sports cases.|Post-ACL reconstruction protocol returned 82% of patients to sport within nine months.|Supervises two interns per rotation.'],
    ['Physiotherapist', 'Physiocare Clinic', 'Nashik', 'Jul 2019', 'May 2021',
      'Managed a caseload averaging 11 patients daily across musculoskeletal and neuro cases.']],
    e: [['MPT, Musculoskeletal', 'Maharashtra University of Health Sciences', 'Nashik', '2017', '2019', '73%'],
      ['BPT', 'Maharashtra University of Health Sciences', 'Nashik', '2013', '2017', '68%']],
    l: [['Registered Physiotherapist', 'Maharashtra State OTPT Council', 'PT/2019/6642', 'Jun 2026']],
    k: [['Clinical', 'Manual therapy, dry needling, exercise prescription, gait analysis'], ['Assessment', 'SPADI, KOOS, LEFS outcome measures']],
  },

  psychology: {
    n: 'Tanvi Shah', h: 'Clinical Psychologist', loc: 'Mumbai, India',
    s: 'Clinical psychologist working with adults on anxiety and mood disorders, primarily CBT and third-wave approaches, in outpatient and telehealth settings.',
    x: [['Clinical Psychologist', 'Mindwell Centre', 'Mumbai', 'Apr 2021', 'now',
      'Carries a caseload of 22 active clients with 18 to 20 sessions per week.|Runs an eight-week group CBT programme; average GAD-7 reduction of 7.4 points across four cohorts.|Provides weekly supervision to two trainee counsellors.'],
    ['Counselling Psychologist', 'Sahaara Foundation', 'Mumbai', 'Jul 2019', 'Mar 2021',
      'Delivered 900+ counselling sessions to low-income clients on a sliding-fee basis.']],
    e: [['M.Phil, Clinical Psychology', 'NIMHANS', 'Bengaluru', '2017', '2019', ''],
      ['M.A, Psychology', 'University of Mumbai', 'Mumbai', '2015', '2017', '76%']],
    l: [['Licensed Clinical Psychologist', 'Rehabilitation Council of India', 'A-58821', 'Aug 2026']],
    k: [['Modalities', 'CBT, DBT skills, ACT, motivational interviewing'], ['Assessment', 'WAIS-IV, MMPI-2, Beck inventories, GAD-7, PHQ-9']],
  },

  'lab-technology': {
    n: 'Prakash Nayak', h: 'Senior Medical Laboratory Technologist', loc: 'Mangaluru, India',
    s: 'Laboratory technologist across clinical biochemistry and haematology in a NABL-accredited lab processing high daily volumes.',
    x: [['Senior Lab Technologist', 'Manipal Diagnostics', 'Mangaluru', 'Mar 2020', 'now',
      'Processes around 380 samples daily across biochemistry and haematology.|Cut average turnaround time for routine panels from 4.5 hours to 2.1.|Maintained a 99.2% internal QC pass rate through two NABL surveillance audits.'],
    ['Lab Technician', 'City Diagnostic Centre', 'Udupi', 'Aug 2017', 'Feb 2020',
      'Handled sample collection, processing and reporting for 150+ samples daily.']],
    e: [['B.Sc, Medical Laboratory Technology', 'Manipal Academy of Higher Education', 'Manipal', '2014', '2017', '78%']],
    k: [['Techniques', 'Automated biochemistry, CBC, coagulation, ELISA, microscopy'], ['Instruments', 'Beckman AU480, Sysmex XN-1000, Cobas e411'], ['Quality', 'NABL 15189, internal QC, Levey-Jennings charting']],
  },

  veterinary: {
    n: 'Dr. Harpreet Singh', h: 'Veterinary Surgeon - Small Animal Practice', loc: 'Jalandhar, Punjab',
    s: 'Veterinary surgeon in small animal practice, with additional large animal field experience in dairy herd health.',
    x: [['Veterinary Surgeon', 'Petcare Veterinary Hospital', 'Jalandhar', 'May 2020', 'now',
      'Handles around 25 consultations daily across canine and feline cases.|Performs 12 to 15 soft tissue surgeries per month including spays and enterotomies.|Set up an in-house diagnostic protocol that cut external referrals 40%.'],
    ['Veterinary Officer', 'Department of Animal Husbandry, Punjab', 'Kapurthala', 'Aug 2017', 'Apr 2020',
      'Covered dairy herd health across 22 villages, roughly 3,400 animals.|Ran vaccination drives reaching 8,000 animals annually.']],
    e: [['B.V.Sc & A.H', 'Guru Angad Dev Veterinary University', 'Ludhiana', '2012', '2017', '72%']],
    l: [['Registered Veterinary Practitioner', 'Punjab State Veterinary Council', 'PSVC/2017/1184', '']],
    k: [['Clinical', 'Soft tissue surgery, small animal medicine, herd health, ultrasonography'], ['Species', 'Canine, feline, bovine, caprine']],
    g: ['Punjabi|Native', 'Hindi|Fluent', 'English|Fluent'],
  },

  journalism: {
    n: 'Sameer Kulkarni', h: 'Investigative Reporter - Urban Affairs', loc: 'Mumbai, India',
    s: 'Reporter covering municipal governance and urban infrastructure, with a record of document-led investigations into public contracting.',
    x: [['Senior Correspondent', 'The Metro Chronicle', 'Mumbai', 'Jan 2021', 'now',
      'Files three to four stories weekly on the urban affairs beat.|A six-month investigation into road contract irregularities led to a Rs 340 crore tender being cancelled.|Built and maintains a database of 2,200 municipal contracts now used across the newsroom.'],
    ['Correspondent', 'Pune Daily', 'Pune', 'Jun 2018', 'Dec 2020',
      'Covered civic administration, averaging 15 filed stories monthly.|Broke the water-billing story picked up by three national outlets.']],
    e: [['M.A, Journalism', 'Symbiosis Institute of Media and Communication', 'Pune', '2016', '2018', '']],
    p: [['Kulkarni, S. (2024). Who builds the roads: inside a decade of municipal tendering.', 'The Metro Chronicle', '2024'],
      ['Kulkarni, S. (2023). The water bills that never arrived.', 'Pune Daily', '2023']],
    k: [['Reporting', 'RTI filings, document analysis, source development, data journalism'], ['Tools', 'Excel, Datawrapper, QGIS, Python (pandas)']],
    a: ['Ramnath Goenka Award shortlist, Investigative Reporting, 2024.'],
  },

  'film-animation': {
    n: 'Aditi Bose', h: 'Senior Compositor', loc: 'Mumbai, India',
    s: 'VFX compositor with seven years in feature and episodic work, specialising in complex keying, set extension and CG integration.',
    x: [['Senior Compositor', 'Prana Studios', 'Mumbai', 'Sep 2021', 'now',
      'Delivered 340+ shots across four feature films and two streaming series.|Leads a team of five compositors on episodic work, averaging 60 shots per episode.|Built a Nuke gizmo set that cut average shot setup time by 25 minutes.'],
    ['Compositor', 'Redchillies.VFX', 'Mumbai', 'Jul 2017', 'Aug 2021',
      'Worked 500+ shots across seven feature films.|Handled greenscreen keying and set extension on two large-scale action sequences.']],
    e: [['Diploma, Visual Effects', 'Whistling Woods International', 'Mumbai', '2015', '2017', '']],
    j: [['Feature - "Kalki Ascend"', 'Nuke, Mocha', '', '2024', 'Senior compositor, 90 shots including full CG environment integration.'],
      ['Series - "Nightwatch" S2', 'Nuke, Silhouette', '', '2023', 'Lead compositor across eight episodes.']],
    k: [['Software', 'Nuke, Mocha Pro, Silhouette, Maya, DaVinci Resolve'], ['Techniques', 'Keying, roto, set extension, CG integration, camera projection']],
  },

  'content-writing': {
    n: 'Ritika Sen', h: 'Senior Content Strategist', loc: 'Remote, India',
    s: 'Content strategist for B2B software companies, working on search-led content programmes and product documentation.',
    x: [['Senior Content Strategist', 'Wavelength Software', 'Remote', 'Mar 2022', 'now',
      'Grew organic traffic from 22k to 130k monthly sessions in 20 months.|Owns a programme producing 18 long-form pieces monthly across three writers.|Restructured product documentation, cutting related support tickets 31%.'],
    ['Content Writer', 'Bluepeak Media', 'Bengaluru', 'Aug 2019', 'Feb 2022',
      'Wrote 400+ published pieces across fintech and SaaS clients.|Took three client blogs to page-one rankings for their primary keywords.']],
    e: [['B.A, English Literature', 'Jadavpur University', 'Kolkata', '2016', '2019', '76%']],
    p: [['The documentation debt nobody budgets for', 'Wavelength Blog', '2024'],
      ['Why your SEO brief is the problem', 'Content Marketing Institute', '2023']],
    k: [['Content', 'SEO strategy, long-form writing, technical documentation, editing'], ['Tools', 'Ahrefs, Semrush, Google Search Console, Markdown, Git']],
  },

  hospitality: {
    n: 'Rohit Chauhan', h: 'Front Office Manager', loc: 'Jaipur, India',
    s: 'Front office manager in five-star property operations, responsible for guest experience scores, room revenue and a 22-person team.',
    x: [['Front Office Manager', 'The Rajputana Palace', 'Jaipur', 'Jun 2021', 'now',
      'Runs front office for a 214-room property averaging 78% occupancy.|Raised guest satisfaction score from 8.1 to 9.0 over eight quarters.|Increased upsell revenue 42% by restructuring the front desk incentive scheme.'],
    ['Assistant Front Office Manager', 'Taj Lake Palace', 'Udaipur', 'Aug 2018', 'May 2021',
      'Supervised a shift team of nine across a 83-room heritage property.|Handled VIP arrivals averaging 40 per month.']],
    e: [['B.Sc, Hospitality and Hotel Administration', 'IHM Pusa', 'New Delhi', '2014', '2017', '74%']],
    k: [['Operations', 'Front office management, revenue management, guest recovery'], ['Systems', 'Opera PMS, IDS, Salesforce']],
    g: ['Hindi|Native', 'English|Fluent', 'French|Intermediate'],
  },

  culinary: {
    n: 'Imran Sheikh', h: 'Sous Chef', loc: 'Goa, India',
    s: 'Sous chef in modern Indian coastal cuisine, running a brigade of 14 across a 120-cover restaurant.',
    x: [['Sous Chef', 'Salt & Tide', 'Goa', 'Nov 2021', 'now',
      'Runs a brigade of 14 across a 120-cover restaurant averaging 190 covers per service at peak.|Cut food cost from 34% to 27% by reworking supplier terms and portion standards.|Co-designed two seasonal menus; the restaurant retained its Top 50 listing across both.'],
    ['Chef de Partie', 'The Bombay Canteen', 'Mumbai', 'Feb 2019', 'Oct 2021',
      'Ran the grill and tandoor sections across 200-cover services.|Trained six commis chefs, four of whom were promoted.']],
    e: [['Diploma, Culinary Arts', 'Institute of Hotel Management', 'Mumbai', '2016', '2018', '']],
    c: [['Food Safety Supervisor (FoSTaC)', 'FSSAI', '2023'], ['HACCP Level 3', 'Highfield', '2022']],
    k: [['Cuisines', 'Modern Indian, coastal seafood, tandoor, fermentation'], ['Kitchen', 'Menu costing, brigade management, inventory, HACCP']],
  },

  aviation: {
    n: 'Capt. Nidhi Sharma', h: 'First Officer - Airbus A320', loc: 'New Delhi, India',
    s: 'Commercial pilot with 3,200 total hours, 2,400 on the A320 family, flying domestic and short-haul international routes.',
    x: [['First Officer - A320', 'IndiGo', 'New Delhi', 'Mar 2020', 'now',
      'Flies roughly 75 sectors monthly across 40 domestic and 8 international destinations.|2,400 hours on type with no reportable incidents.|Line training support for six new first officers.'],
    ['Trainee Pilot', 'Indira Gandhi Rashtriya Uran Akademi', 'Rae Bareli', 'Jun 2017', 'Dec 2019',
      'Completed 220 hours of flight training on Cessna 172 and Diamond DA40.']],
    e: [['B.Sc, Aviation', 'IGRUA', 'Rae Bareli', '2017', '2019', '']],
    l: [['Airline Transport Pilot Licence (Frozen)', 'DGCA India', 'ATPL/2019/11284', 'Jun 2026'],
      ['Class 1 Medical Certificate', 'DGCA India', 'MED/2024/44921', 'Feb 2026']],
    k: [['Ratings', 'A320 type rating, IR, ME, RTR(A)'], ['Operations', 'CRM, SOP adherence, low-visibility operations']],
    g: ['English|Fluent', 'Hindi|Native'],
  },

  'retail-customer': {
    n: 'Pooja Rathore', h: 'Store Manager', loc: 'Indore, India',
    s: 'Retail store manager for apparel, responsible for sales targets, stock accuracy and a team of 16.',
    x: [['Store Manager', 'Trendline Apparel', 'Indore', 'Feb 2021', 'now',
      'Runs a 4,200 sq ft store averaging Rs 92 lakh annual revenue, at 108% of target for three consecutive years.|Cut shrinkage from 1.9% to 0.6% through a revised stock-count routine.|Raised average basket size from Rs 1,840 to Rs 2,410 through staff training on cross-selling.'],
    ['Assistant Store Manager', 'Fabindia', 'Bhopal', 'Jul 2018', 'Jan 2021',
      'Supervised a team of nine across two shifts.|Maintained a customer satisfaction score above 4.5 out of 5 for eight quarters.']],
    e: [['B.Com', 'Devi Ahilya Vishwavidyalaya', 'Indore', '2015', '2018', '69%']],
    k: [['Retail', 'Visual merchandising, inventory control, shrinkage reduction, rostering'], ['Systems', 'SAP Retail, POS systems, Excel']],
  },

  'skilled-trades': {
    n: 'Suresh Pawar', h: 'Industrial Electrician', loc: 'Aurangabad, India',
    s: 'Industrial electrician with eleven years in plant maintenance, covering LT and HT systems, VFDs and PLC-controlled machinery.',
    x: [['Senior Electrician', 'Endurance Technologies', 'Aurangabad', 'Apr 2018', 'now',
      'Maintains electrical systems across 140 machines on a two-shift plant.|Cut unplanned electrical downtime from 46 to 12 hours per quarter.|Zero reportable safety incidents across seven years.'],
    ['Electrician', 'Varroc Engineering', 'Aurangabad', 'Jun 2013', 'Mar 2018',
      'Handled preventive maintenance on 80+ machines to a weekly schedule.|Completed 400+ breakdown calls with a first-time fix rate above 85%.']],
    e: [['ITI, Electrician Trade', 'Government ITI', 'Aurangabad', '2010', '2012', 'First Class']],
    l: [['Electrical Supervisor Licence', 'Government of Maharashtra', 'MH/ESL/2015/7714', 'Dec 2026'],
      ['Driving Licence - LMV', 'RTO Aurangabad', 'MH20/2011/442119', 'Sep 2031']],
    k: [['Trade', 'LT/HT panels, VFD commissioning, motor rewinding, cable termination'], ['Controls', 'Allen-Bradley PLC basics, sensor troubleshooting'], ['Safety', 'LOTO, arc flash awareness, work permit systems']],
    g: ['Marathi|Native', 'Hindi|Fluent', 'English|Basic'],
  },

  'banking-bfsi': {
    n: 'Deepak Agarwal', h: 'Branch Manager - Retail Banking', loc: 'Jaipur, India',
    s: 'Retail banking manager with nine years across branch operations, lending and portfolio quality in tier-2 markets.',
    x: [['Branch Manager', 'HDFC Bank', 'Jaipur', 'Jul 2021', 'now',
      'Manages a branch with a Rs 310 crore book and a team of 18.|Grew CASA deposits 34% in two years while holding NPA at 0.8%.|Disbursed Rs 96 crore in retail loans in FY24, 118% of target.'],
    ['Deputy Manager - Retail Assets', 'ICICI Bank', 'Kota', 'Aug 2016', 'Jun 2021',
      'Underwrote and disbursed Rs 180 crore of home and auto loans over five years.|Kept portfolio delinquency below 1.2% against a regional average of 2.1%.']],
    e: [['MBA, Finance', 'IIS University', 'Jaipur', '2014', '2016', ''], ['B.Com', 'University of Rajasthan', 'Jaipur', '2011', '2014', '73%']],
    c: [['JAIIB', 'Indian Institute of Banking and Finance', '2018'], ['NISM Series V-A', 'NISM', '2020']],
    k: [['Banking', 'Retail lending, credit appraisal, CASA growth, branch P&L'], ['Compliance', 'KYC/AML, RBI guidelines, audit readiness']],
  },

  'insurance-actuarial': {
    n: 'Shreya Ganesan', h: 'Actuarial Analyst - General Insurance', loc: 'Mumbai, India',
    s: 'Actuarial analyst working on reserving and pricing for motor and health portfolios, nine papers into the IFoA qualification.',
    x: [['Actuarial Analyst', 'Bharat General Insurance', 'Mumbai', 'Jun 2021', 'now',
      'Runs quarterly reserving for a motor book of Rs 1,400 crore gross written premium.|Rebuilt the health pricing model, improving the loss ratio by 4.2 points in one renewal cycle.|Automated the reserving pack in R, cutting production from six days to one.'],
    ['Actuarial Trainee', 'Sigma Consulting Actuaries', 'Mumbai', 'Jul 2019', 'May 2021',
      'Supported IFRS 17 readiness work for three general insurance clients.|Built experience analyses across 1.2M policy records.']],
    e: [['B.Sc, Actuarial Science', 'NMIMS', 'Mumbai', '2016', '2019', 'CGPA 3.7 / 4']],
    c: [['CM1, CM2, CS1, CS2, CB1, CB2, CB3, CP1, CP3 passed', 'Institute and Faculty of Actuaries', '2024'],
      ['Associate membership in progress', 'Institute of Actuaries of India', '2024']],
    k: [['Technical', 'Reserving (chain ladder, BF), pricing, IFRS 17, experience analysis'], ['Tools', 'R, Python, SQL, ResQ, Advanced Excel/VBA']],
  },

  'real-estate': {
    n: 'Vivek Sinha', h: 'Commercial Leasing Manager', loc: 'Bengaluru, India',
    s: 'Commercial real estate professional focused on office leasing and tenant representation across Bengaluru submarkets.',
    x: [['Leasing Manager', 'Prestige Commercial', 'Bengaluru', 'Mar 2021', 'now',
      'Leased 640,000 sq ft of Grade A office space with an aggregate deal value of Rs 210 crore.|Raised portfolio occupancy from 81% to 94% across four assets.|Renegotiated 22 renewals with an average 11% rent escalation.'],
    ['Senior Executive - Transactions', 'CBRE India', 'Bengaluru', 'Jul 2018', 'Feb 2021',
      'Closed 38 tenant representation mandates totalling 280,000 sq ft.']],
    e: [['MBA, Real Estate', 'RICS School of Built Environment', 'Noida', '2016', '2018', '']],
    l: [['RERA Registered Agent', 'Karnataka RERA', 'PRM/KA/RERA/1251/446/AG/2021', 'Mar 2026']],
    k: [['Transactions', 'Office leasing, tenant representation, lease structuring, market research'], ['Analysis', 'Yield analysis, Argus basics, Excel modelling']],
  },

  'social-work-ngo': {
    n: 'Fatima Ansari', h: 'Programme Manager - Education', loc: 'Lucknow, India',
    s: 'Programme manager running girls\' education initiatives across rural Uttar Pradesh, from field delivery to donor reporting.',
    x: [['Programme Manager', 'Shiksha Sahyog Foundation', 'Lucknow', 'Apr 2021', 'now',
      'Runs an education programme reaching 14,000 girls across 180 villages in four districts.|Raised programme retention from 71% to 89% across three academic years.|Manages an annual budget of Rs 3.4 crore and a field team of 26.'],
    ['Field Coordinator', 'Pratham Education Foundation', 'Varanasi', 'Jun 2018', 'Mar 2021',
      'Coordinated remedial learning camps across 45 villages reaching 3,200 children.|Trained 120 community volunteers on the teaching methodology.']],
    e: [['MSW', 'Tata Institute of Social Sciences', 'Mumbai', '2016', '2018', '']],
    a: ['Secured a Rs 1.8 crore three-year grant from the Azim Premji Foundation, 2023.',
      'Programme selected as a state government case study for scaling, 2024.'],
    k: [['Programme', 'Monitoring and evaluation, budget management, donor reporting, community mobilisation'], ['Tools', 'KoBoToolbox, Power BI, Excel']],
    g: ['Hindi|Native', 'Urdu|Fluent', 'English|Fluent'],
  },

  'defence-veteran': {
    n: 'Maj. (Retd.) Arvind Rathore', h: 'Operations & Logistics Manager - ex-Indian Army', loc: 'Jaipur, India',
    s: 'Former Indian Army Major with fourteen years in operations and logistics, now moving to civilian operations management. Experience covers supply chain across difficult terrain, managing 150 personnel and assets worth Rs 80 crore.',
    x: [['Major - Logistics and Operations (equivalent: Senior Operations Manager)', 'Indian Army, Army Service Corps', 'Northern Command', 'Jun 2016', 'Mar 2024',
      'Directed supply operations for a formation of 2,400 personnel across high-altitude terrain.|Managed a vehicle and equipment fleet valued at Rs 80 crore with 94% availability.|Led a team of 150 including 12 direct reports across four detachments.|Cut fuel consumption 17% through revised convoy scheduling.'],
    ['Captain - Supply Officer (equivalent: Operations Manager)', 'Indian Army, Army Service Corps', 'Western Command', 'Jun 2010', 'May 2016',
      'Ran a supply depot handling 400 tonnes of stores monthly.|Coordinated disaster relief logistics during the 2013 floods, moving 1,200 tonnes in nine days.']],
    e: [['M.Sc, Defence Studies', 'Madras University', 'Chennai', '2014', '2016', ''],
      ['B.Sc', 'National Defence Academy / JNU', 'Pune', '2006', '2009', '']],
    c: [['Project Management Professional (PMP)', 'PMI', '2024'], ['Lean Six Sigma Green Belt', 'KPMG', '2023']],
    k: [['Operations', 'Supply chain, fleet management, crisis logistics, vendor management'], ['Leadership', 'Team management, training and development, SOP design'], ['Clearance', 'Held Secret-level clearance during service']],
    a: ['Chief of Army Staff Commendation Card, 2019, for flood relief logistics.'],
  },

  general: {
    n: 'Neel Prasad', h: 'Operations Executive', loc: 'Bengaluru, India',
    s: 'Operations professional with five years across process improvement, vendor coordination and reporting in a services business.',
    x: [['Operations Executive', 'Clearpath Services', 'Bengaluru', 'Aug 2021', 'now',
      'Coordinates daily operations for a team of 12 serving 40 client accounts.|Cut average request turnaround from 3 days to 1.2 by redesigning the intake process.|Reduced vendor spend 14% by consolidating five suppliers into two.'],
    ['Operations Associate', 'Trueline Solutions', 'Bengaluru', 'Jul 2019', 'Jul 2021',
      'Handled scheduling and reporting for 200+ monthly service jobs.|Built the weekly dashboard now used by the operations head.']],
    e: [['B.Com', 'Christ University', 'Bengaluru', '2016', '2019', '72%']],
    k: [['Operations', 'Process improvement, vendor management, scheduling, reporting'], ['Tools', 'Excel, Power BI, Zoho, Google Workspace']],
  },
};

/* ---------------------------------------------------------------- builder */

function splitBullets(s) {
  return String(s || '').split('|').map((x) => x.trim()).filter(Boolean).join('\n');
}

export function hasSample(id) {
  return Boolean(SAMPLES[id]);
}

/** Build a full CV data object for one profession's sample. */
export function buildSample(id, settings) {
  const spec = SAMPLES[id];
  if (!spec) return null;

  const d = blankData();
  // Keep the viewer's region and look, change only what the profession dictates.
  if (settings) {
    d.settings.region = settings.region;
    d.settings.accent = settings.accent;
    d.settings.font = settings.font;
    d.settings.paper = settings.paper;
  }
  applyProfession(d, id);

  d.basics.fullName = spec.n;
  d.basics.headline = spec.h;
  d.basics.location = spec.loc || '';
  d.basics.summary = spec.s || '';
  const handle = spec.n.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
  d.basics.email = (handle[0] || 'name') + '.' + (handle[handle.length - 1] || 'surname') + '@example.com';
  d.basics.phone = '+91 98765 43210';

  (spec.x || []).forEach(([role, company, city, start, end, bullets]) => {
    d.experience.push({
      role, company, location: city, start,
      end: end === 'now' ? '' : end,
      current: end === 'now',
      bullets: splitBullets(bullets),
    });
  });

  (spec.e || []).forEach(([degree, school, city, start, end, score]) => {
    d.education.push({ degree, school, location: city, start, end, score: score || '', details: '' });
  });

  (spec.j || []).forEach(([name, tech, link, date, bullets]) => {
    d.projects.push({ name, tech, link, date, bullets: splitBullets(bullets) });
  });

  (spec.k || []).forEach(([group, items]) => d.skills.push({ group, items }));
  (spec.c || []).forEach(([name, issuer, year]) => d.certifications.push({ name, issuer, year, link: '' }));
  (spec.l || []).forEach(([name, authority, number, expiry]) => {
    d.licences.push({ name, authority, number, expiry: expiry || '' });
  });
  (spec.p || []).forEach(([title, venue, year]) => d.publications.push({ title, venue, year, link: '' }));
  (spec.a || []).forEach((text) => d.achievements.push({ text }));
  (spec.g || []).forEach((pair) => {
    const [name, level] = pair.split('|');
    d.languages.push({ name, level: level || 'Fluent' });
  });

  if (!d.languages.length) {
    d.languages.push({ name: 'English', level: 'Fluent' }, { name: 'Hindi', level: 'Native' });
  }
  return d;
}

/** Professions that still need a sample written - surfaced in the UI, not hidden. */
export function missingSamples() {
  return Object.keys(PROFESSIONS).filter((id) => !SAMPLES[id]);
}

export { SAMPLES };
