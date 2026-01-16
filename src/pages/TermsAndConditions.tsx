import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const sections = [
  {
    id: "clause-1",
    title: "1. Definitions and Interpretation",
    subSections: [
      {
        id: "clause-1-1",
        title: "1.1 Definitions",
        intro:
          "In these Terms and Conditions, unless the context indicates otherwise, the following words and expressions shall bear the meanings assigned to them below:",
        items: [
          "1.1.1 \"Application\" means the Nudoc web-based software application operated by the Provider.",
          "1.1.2 \"Business Plan\" means the subscription plan intended for businesses and employers, allowing for multiple Users under a single Account.",
          "1.1.3 \"Domestic Plan\" means the subscription plan intended for private households employing domestic workers, limited to a single User.",
          "1.1.4 \"Documents\" means employment-related documents generated through the Application, including but not limited to contracts of employment, disciplinary notices, warnings, and related HR documentation.",
          "1.1.5 \"Employee Data\" means any personal or employment-related information relating to employees or domestic workers captured, uploaded, stored, or processed on the Application.",
          "1.1.6 \"Provider\" means The Labour Law Association South Africa CC, duly incorporated and operating in the Republic of South Africa.",
          "1.1.7 \"Services\" means the functionality made available through the Application, including the generation of Documents, storage and management of Employee Data, user access management, and automated notifications relating to contract and warning expiry dates.",
          "1.1.8 \"Subscription\" means the paid or trial-based right to access and use the Services in accordance with the selected plan.",
          "1.1.9 \"Terms\" means these Terms and Conditions, as amended from time to time.",
          "1.1.10 \"User\" means any natural person who creates an account on the Application or who is granted authorised login access to the Application by a master user, and who uses the Services, whether as a sole user under a Domestic Plan or as a master user or sub-user under a Business Plan.",
          "1.1.11 \"User Content\" means all data, information, Documents, Employee Data, and materials uploaded to or generated through the Application by or on behalf of a User.",
          "1.1.12 \"Billing Cycle\" means the recurring period selected by the User for payment of subscription fees, being either a monthly or annual billing period, as selected during registration or as subsequently applied to the account.",
        ],
      },
      {
        id: "clause-1-2",
        title: "1.2 Interpretation",
        items: [
          "1.2.1 Words importing the singular shall include the plural and vice versa.",
          "1.2.2 Words importing any gender shall include the other genders.",
          "1.2.3 Headings are for convenience only and shall not affect the interpretation of these Terms.",
          "1.2.4 Any reference to legislation shall include all amendments, re-enactments, or replacements thereof.",
          "1.2.5 Where a term is not defined herein, it shall be given its ordinary meaning in South African law and commerce.",
        ],
      },
    ],
  },
  {
    id: "clause-2",
    title: "2. Acceptance of Terms and Electronic Consent",
    subSections: [
      {
        id: "clause-2-1",
        title: "2.1 Acceptance of Terms",
        items: [
          "2.1.1 These Terms constitute a legally binding agreement between the User and the Provider.",
          "2.1.2 By registering an account on the Application, selecting the checkbox indicating acceptance of these Terms, and proceeding with the sign-up process, the User acknowledges that he or she has read, understood, and agrees to be bound by these Terms.",
          "2.1.3 The User expressly agrees that acceptance of these Terms occurs by way of electronic action and that such acceptance constitutes a valid and binding agreement in terms of the Electronic Communications and Transactions Act 25 of 2002.",
          "2.1.4 The Provider shall be entitled to rely on the electronic acceptance of these Terms as recorded by the Application as conclusive proof of the User's agreement.",
          "2.1.5 No handwritten or physical signature shall be required for the validity or enforceability of these Terms.",
        ],
      },
      {
        id: "clause-2-2",
        title: "2.2 Authority and Capacity",
        items: [
          "2.2.1 The User warrants that he or she has the legal capacity to enter into these Terms.",
          "2.2.2 Where the User registers or uses the Application on behalf of a juristic person or household, the User warrants that he or she has the necessary authority to bind such entity or household to these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-3",
    title: "3. User Accounts and Access Rights",
    subSections: [
      {
        id: "clause-3-1",
        title: "3.1 Account Registration",
        items: [
          "3.1.1 Access to the Application requires the creation of a User account.",
          "3.1.2 Each account shall be registered to a single User who shall be designated as the master user in the case of a Business Plan, or the sole User in the case of a Domestic Plan.",
          "3.1.3 The User warrants that all information provided during registration is accurate, complete, and kept up to date.",
        ],
      },
      {
        id: "clause-3-2",
        title: "3.2 Business Plan Users",
        items: [
          "3.2.1 A Business Plan permits the master user to create, manage, and revoke access for additional authorised Users (\"sub-users\").",
          "3.2.2 The master user shall be responsible for all acts and omissions of sub-users granted access under the Business Plan.",
          "3.2.3 Any action performed by a sub-user shall be deemed to have been performed with the authority of the master user.",
        ],
      },
      {
        id: "clause-3-3",
        title: "3.3 Domestic Plan Users",
        items: [
          "3.3.1 A Domestic Plan permits access by a single User only.",
          "3.3.2 The User under a Domestic Plan shall not be entitled to create or grant access to any additional Users.",
        ],
      },
      {
        id: "clause-3-4",
        title: "3.4 Account Security",
        items: [
          "3.4.1 The User shall be responsible for maintaining the confidentiality of login credentials and for all activities conducted through the User's account.",
          "3.4.2 The Provider shall not be liable for any loss or damage arising from unauthorised access resulting from the User's failure to secure login credentials.",
        ],
      },
      {
        id: "clause-3-5",
        title: "3.5 Account Responsibility",
        items: [
          "3.5.1 The User acknowledges that all User Content uploaded, generated, or managed through the account remains the sole responsibility of the User.",
          "3.5.2 The Provider shall be entitled to rely on the authority of the User and, where applicable, the master user, in relation to all instructions, actions, and data processed on the Application.",
        ],
      },
    ],
  },
  {
    id: "clause-4",
    title: "4. Use of the Application",
    subSections: [
      {
        id: "clause-4-1",
        title: "4.1 Permitted Use",
        items: [
          "4.1.1 The user may use the Application solely for lawful purposes and in accordance with these Terms.",
          "4.1.2 The Services may be used only for the generation of employment-related Documents, the storage and management of Employee Data, and related HR administrative functions made available through the Application.",
          "4.1.3 The User acknowledges that the Application is an administrative and document-generation tool and does not provide legal advice.",
        ],
      },
      {
        id: "clause-4-2",
        title: "4.2 Prohibited Conduct",
        items: [
          "4.2.1 The User shall not use the Application to engage in any unlawful, fraudulent, or abusive conduct.",
          "4.2.2 The User shall not upload, store, or process any data that infringes the rights of any third party or violates any applicable law.",
          "4.2.3 The User shall not attempt to gain unauthorised access to the Application, interfere with its operation, or use the Application in a manner that may damage, disable, or impair the Services.",
          "4.2.4 The User shall not reverse engineer, copy, modify, or exploit any part of the Application or the Provider's intellectual property, except as expressly permitted in these Terms.",
        ],
      },
      {
        id: "clause-4-3",
        title: "4.3 Compliance With Law",
        items: [
          "4.3.1 The User shall be solely responsible for ensuring that the use of the Application, the Documents generated, and the processing of Employee Data comply with all applicable laws, including but not limited to labour legislation and data protection laws.",
          "4.3.2 The Provider shall not be responsible for verifying the legal compliance, accuracy, or suitability of any Documents generated or data uploaded by the User.",
        ],
      },
      {
        id: "clause-4-4",
        title: "4.4 Right to Restrict Use",
        items: [
          "4.4.1 The Provider reserves the right to restrict, suspend, or terminate access to the Application where the User's use is reasonably suspected to be in breach of these Terms or applicable law.",
          "4.4.2 Any restriction or suspension shall not limit the Provider’s rights under these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-5",
    title: "5. Intellectual Property Rights",
    subSections: [
      {
        id: "clause-5-1",
        title: "5.1 Ownership",
        items: [
          "5.1.1 All intellectual property rights in and to the Application, the Services, the software, systems, workflows, document templates, structure, design, text, graphics, and functionality made available by the Provider shall remain the exclusive property of the Provider or its licensors.",
          "5.1.2 Nothing in these Terms shall be construed as transferring any intellectual property rights from the Provider to the User.",
        ],
      },
      {
        id: "clause-5-2",
        title: "5.2 Licence to Use",
        items: [
          "5.2.1 Subject to the User's compliance with these Terms, the Provider grants the User a limited, non-exclusive, non-transferable, and revocable licence to access and use the Application and Services for their intended purpose during the Subscription period.",
          "5.2.2 The User may use Documents generated through the Application for their internal employment and HR-related purposes.",
        ],
      },
      {
        id: "clause-5-3",
        title: "5.3 Restrictions",
        items: [
          "5.3.1 The User shall not copy, reproduce, modify, distribute, sell, license, sublicense, or commercially exploit the Application, any document templates, or any part of the Services, except to the extent necessary for the lawful use of generated Documents.",
          "5.3.2 The User shall not reverse engineer, decompile, or attempt to derive the source code, logic, or underlying structure of the Application.",
        ],
      },
      {
        id: "clause-5-4",
        title: "5.4 User Content",
        items: [
          "5.4.1 All intellectual property rights in User Content shall remain vested in the User.",
          "5.4.2 The User grants the Provider a limited licence to host, store, process, and display User Content solely for the purpose of providing the Services.",
        ],
      },
    ],
  },
  {
    id: "clause-6",
    title: "6. User Content and Employee Data",
    subSections: [
      {
        id: "clause-6-1",
        title: "6.1 Ownership and Responsibility",
        items: [
          "6.1.1 All User Content, including Employee Data, uploaded to, stored on, or generated through the Application shall remain the property and responsibility of the User.",
          "6.1.2 The User warrants that he or she has the lawful authority, legal basis, and, where required, consent to upload, process, store, and manage all User Content and Employee Data on the Application.",
          "6.1.3 The User remains solely responsible for compliance with all applicable labour, employment, and data protection laws in relation to User Content and Employee Data.",
        ],
      },
      {
        id: "clause-6-2",
        title: "6.2 Processing of Employee Data",
        items: [
          "6.2.1 The Provider processes Employee Data solely on the instructions of the User and only for the purpose of providing the Services.",
          "6.2.2 The User acknowledges that the Provider does not determine the purpose or means of processing Employee Data and acts as an operator for purposes of applicable data protection legislation.",
          "6.2.3 The Provider shall not be responsible for determining the retention periods, lawfulness, or suitability of any Employee Data processed on behalf of the User.",
        ],
      },
      {
        id: "clause-6-3",
        title: "6.3 Accuracy and Lawfulness of Data",
        items: [
          "6.3.1 The User shall ensure that all User Content and Employee Data is accurate, complete, up to date, and lawfully obtained.",
          "6.3.2 The Provider shall not verify the accuracy, legality, or completeness of any User Content or Employee Data.",
        ],
      },
      {
        id: "clause-6-4",
        title: "6.4 Data Security",
        items: [
          "6.4.1 The Provider shall implement reasonable technical and organisational measures to safeguard User Content and Employee Data against unauthorised access, loss, or damage.",
          "6.4.2 The User acknowledges that no system is completely secure and that the Provider does not guarantee absolute security of User Content or Employee Data.",
        ],
      },
      {
        id: "clause-6-5",
        title: "6.5 Access Control and Authority",
        items: [
          "6.5.1 Access to User Content and Employee Data is controlled through the User's account credentials.",
          "6.5.2 The Provider shall be entitled to rely on the authority of the User and, where applicable, the master user, in relation to all instructions, actions, and permissions relating to User Content and Employee Data.",
        ],
      },
      {
        id: "clause-6-6",
        title: "6.6 Removal or Restriction of Content",
        items: [
          "6.6.1 The Provider reserves the right to remove, restrict, or disable access to any User Content where such content is reasonably suspected to be unlawful, infringing, or in breach of these Terms.",
          "6.6.2 Any removal or restriction of User Content shall not limit the Provider's rights or remedies under these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-7",
    title: "7. Data Protection and Privacy",
    subSections: [
      {
        id: "clause-7-1",
        title: "7.1 Compliance With Data Protection Laws",
        items: [
          "7.1.1 The Provider processes all personal information in accordance with the Protection of Personal Information Act 4 of 2013 (\"POPIA\").",
          "7.1.2 The User acknowledges that, for purposes of POPIA, the User is the responsible party and the Provider acts as an operator in respect of Employee Data and User Content.",
        ],
      },
      {
        id: "clause-7-2",
        title: "7.2 Information Security Measures",
        items: [
          "7.2.1 The Provider implements and maintains appropriate technical and organisational security measures designed to protect personal information against loss, unauthorised access, destruction, misuse, or disclosure.",
          "7.2.2 The Provider's information security measures are aligned with and compliant with the principles of ISO27001, as implemented internally by the Provider, but are not represented as independently certified unless expressly stated otherwise.",
        ],
      },
      {
        id: "clause-7-3",
        title: "7.3 Confidentiality and Access Control",
        items: [
          "7.3.1 Access to personal information is restricted to authorised personnel and systems only, in accordance with the Provider's internal access control policies.",
          "7.3.2 The Provider shall take reasonable steps to ensure that persons authorised to process personal information are bound by appropriate confidentiality obligations.",
        ],
      },
      {
        id: "clause-7-4",
        title: "7.4 Data Breach Management",
        items: [
          "7.4.1 In the event of a confirmed personal information security compromise as contemplated in POPIA, the Provider shall notify the User within a reasonable time and provide relevant information required to enable the User to comply with its statutory notification obligations.",
          "7.4.2 The Provider shall cooperate with the User to the extent reasonably required in relation to any investigation or remedial steps arising from such security compromise.",
        ],
      },
      {
        id: "clause-7-5",
        title: "7.5 Privacy Policy",
        items: [
          "7.5.1 The processing of personal information is further governed by the Provider's Privacy Policy, which forms an integral part of these Terms.",
          "7.5.2 In the event of a conflict between these Terms and the Privacy Policy, these Terms shall prevail to the extent of such conflict.",
        ],
      },
      {
        id: "clause-7-6",
        title: "7.6 Cross-Border Data Processing",
        items: [
          "7.6.1 The User acknowledges that personal information may be processed or stored using cloud-based infrastructure, including infrastructure located outside the Republic of South Africa, provided that appropriate data protection safeguards are in place as required by POPIA.",
        ],
      },
    ],
  },
  {
    id: "clause-8",
    title: "8. Fees, Subscriptions, and Payments",
    subSections: [
      {
        id: "clause-8-1",
        title: "8.1 Subscription Plans",
        items: [
          "8.1.1 Access to the Application and Services is provided on a subscription basis, subject to the selected subscription plan and applicable fees.",
          "8.1.2 he Provider offers separate and distinct subscription plans, including a Business Plan and a Domestic Plan, each with its own features, pricing structure, and permitted use.",
          "8.1.3 The Business Plan and Domestic Plan are not interchangeable, and a User shall not be entitled to convert, migrate, or transfer an account from one plan to the other.",
          "8.1.4 A User may hold both a Business Plan account and a Domestic Plan account, provided that each plan is registered, accessed, and billed under a separate account.",
        ],
      },
      {
        id: "clause-8-2",
        title: "8.2 Fees and Billing",
        items: [
          "8.2.1 The User agrees to pay all applicable subscription fees in advance, in accordance with the selected plan and billing cycle.",
          "8.2.2 All fees are quoted in South African Rand (ZAR) unless stated otherwise and are exclusive of value-added tax (VAT), where applicable.",
          "8.2.4 Payment of subscription fees shall be processed via the Provider's designated third-party payment service providers.",
        ],
      },
      {
        id: "clause-8-3",
        title: "8.3 Business Plan Variable Fees",
        items: [
          "8.3.1 In addition to the base subscription fee for the Business Plan, the User shall be charged an additional fee of R2.50 (three Rand) per employee profile added to the Application.",
          "8.3.2 The per-employee fee applicable to the Business Plan shall be calculated based on the highest number of employee profiles recorded on the account during the month immediately preceding the billing date, regardless of any subsequent reduction in the number of employee profiles prior to billing.",
          "8.3.3 The User acknowledges that the removal of employee profiles may not result in an immediate reduction of fees and that billing adjustments, if any, shall be applied in accordance with the Provider's billing rules as displayed on the Application.",
          "8.3.4 In addition to the base subscription fee and employee-based fees applicable to the Business Plan, the User shall be charged an additional fee of R30.00 (thirty Rand) per additional registered User (sub-user) granted access to the Application.",
        ],
      },
      {
        id: "clause-8-4",
        title: "8.4 Renewals",
        items: [
          "8.4.1 Subscriptions shall automatically renew at the end of each billing cycle unless cancelled by the User prior to the renewal date.",
          "8.4.2 The User authorises the Provider to charge the applicable subscription fees for each renewal period using the payment method on record.",
        ],
      },
      {
        id: "clause-8-5",
        title: "8.5 Changes to Subscription",
        items: [
          "8.5.1 The User may upgrade or downgrade the subscription plan in accordance with the options made available on the Application.",
          "8.5.2 Any changes to a subscription plan may result in a pro-rated adjustment of fees, as determined by the Provider and communicated via the Application.",
        ],
      },
      {
        id: "clause-8-6",
        title: "8.6 Non-Payment",
        items: [
          "8.6.1 If any subscription fee is not paid when due, the Provider reserves the right to suspend or restrict access to the Application and Services until payment is received.",
          "8.6.2 Suspension or restriction of access due to non-payment shall not relieve the User of the obligation to pay outstanding amounts.",
        ],
      },
      {
        id: "clause-8-7",
        title: "8.7 Refunds",
        items: [
          "8.7.1 Except where required by applicable law, subscription fees are non-refundable.",
          "8.7.2 No refunds shall be provided for partial use of the Services or unused subscription periods.",
        ],
      },
    ],
  },
  {
    id: "clause-9",
    title: "9. Suspension and Termination",
    subSections: [
      {
        id: "clause-9-1",
        title: "9.1 Suspension of Access",
        items: [
          "9.1.1 The Provider reserves the right to suspend or restrict the User's access to the Application, in whole or in part, with immediate effect where the User is reasonably suspected of breaching these Terms or applicable law.",
          "9.1.2 Access will also be suspended where subscription fees remain unpaid after the due date.",
          "9.1.3 Suspension of access shall not relieve the User of any obligation to pay outstanding fees.",
        ],
      },
      {
        id: "clause-9-2",
        title: "9.2 Termination by the User",
        items: [
          "9.2.1 The User may terminate the Subscription by cancelling the account through the Application, subject to any notice requirements displayed on the Application.",
          "9.2.2 Termination by the User shall take effect at the end of the applicable billing cycle, unless otherwise stated.",
        ],
      },
      {
        id: "clause-9-3",
        title: "9.3 Termination by the Provider",
        items: [
          "9.3.1 The Provider may terminate the User's access to the Application and Services on written notice where the User commits a material breach of these Terms and fails to remedy such breach within a reasonable period after being notified.",
          "9.3.2 The Provider may terminate access with immediate effect where the breach is incapable of remedy or where continued access poses a legal, security, or operational risk.",
        ],
      },
      {
        id: "clause-9-4",
        title: "9.4 Effect of Termination",
        items: [
          "9.4.1 Upon termination, the User's right to access and use the Application and Services shall immediately cease.",
          "9.4.2 The User remains liable for all fees accrued up to the effective date of termination.",
          "9.4.3 Termination shall not affect any rights or obligations which by their nature are intended to survive termination, including but not limited to clauses relating to intellectual property, data protection, limitation of liability, and indemnity.",
        ],
      },
    ],
  },
  {
    id: "clause-10",
    title: "10. Availability of Services and Maintenance",
    subSections: [
      {
        id: "clause-10-1",
        title: "10.1 Service Availability",
        items: [
          "10.1.1 The Provider shall use reasonable efforts to make the Application and Services available to the User on a continuous basis.",
          "10.1.2 The User acknowledges that uninterrupted access to the Application is not guaranteed and that availability may be affected by factors beyond the Provider's reasonable control.",
        ],
      },
      {
        id: "clause-10-2",
        title: "10.2 Maintenance and Updates",
        items: [
          "10.2.1 The Provider may perform scheduled or unscheduled maintenance, updates, or enhancements to the Application from time to time.",
          "10.2.2 Where reasonably practicable, the Provider shall provide advance notice of scheduled maintenance that may materially affect access to the Services.",
        ],
      },
      {
        id: "clause-10-3",
        title: "10.3 Service Interruptions",
        items: [
          "10.3.1 The Provider shall not be liable for any loss, damage, or interruption arising from temporary unavailability of the Application due to maintenance, system failures, third-party service disruptions, or force majeure events.",
          "10.3.2 Temporary interruptions shall not constitute a breach of these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-11",
    title: "11. Disclaimer of Warranties",
    subSections: [
      {
        id: "clause-11-1",
        title: "11.1 As-Is Basis",
        items: [
          "11.1.1 The Application and Services are provided on an \"as is\" and \"as available\" basis.",
          "11.1.2 The Provider makes no warranties or representations, whether express or implied, regarding the availability, accuracy, completeness, reliability, or fitness for purpose of the Application or any Documents generated through the Services.",
        ],
      },
      {
        id: "clause-11-2",
        title: "11.2 No Legal Advice",
        items: [
          "11.2.1 The User acknowledges that the Application is a document-generation and administrative tool and does not provide legal advice.",
          "11.2.2 The Provider does not warrant that any Documents generated through the Application comply with the User's specific legal, regulatory, or operational requirements.",
        ],
      },
      {
        id: "clause-11-3",
        title: "11.3 Statutory Warranties",
        items: [
          "11.3.1 To the maximum extent permitted by applicable law, all warranties implied by statute, common law, or otherwise are excluded.",
          "11.3.2 Nothing in these Terms shall exclude or limit any warranty or right that cannot lawfully be excluded or limited in terms of the Consumer Protection Act 68 of 2008, where applicable.",
        ],
      },
    ],
  },
  {
    id: "clause-12",
    title: "12. Limitation of Liability",
    subSections: [
      {
        id: "clause-12-1",
        title: "12.1 Exclusion of Certain Losses",
        items: [
          "12.1.1 To the maximum extent permitted by applicable law, the Provider shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including but not limited to loss of profits, loss of business, loss of data, or loss of goodwill, arising from or in connection with the use of the Application or Services.",
        ],
      },
      {
        id: "clause-12-2",
        title: "12.2 Limitation of Liability",
        items: [
          "12.2.1 The Provider's total aggregate liability to the User for any claim arising out of or in connection with these Terms, whether in contract, delict, or otherwise, shall be limited to the total subscription fees actually paid by the User to the Provider in the three (3) months preceding the event giving rise to the claim.",
        ],
      },
      {
        id: "clause-12-3",
        title: "12.3 Assumption of Risk",
        items: [
          "12.3.1 The User uses the Application and Services at his or her own risk.",
          "12.3.2 The User acknowledges that reliance on Documents generated through the Application is at the User's discretion and risk.",
        ],
      },
      {
        id: "clause-12-4",
        title: "12.4 Statutory Rights",
        items: [
          "12.4.1 Nothing in these Terms shall exclude or limit liability for death or personal injury caused by gross negligence or any liability which cannot lawfully be excluded or limited in terms of applicable law.",
          "12.4.2 Where the Consumer Protection Act 68 of 2008 applies, the User's attention is expressly drawn to the fact that this clause limits the Provider's liability as contemplated in section 49 of the Act.",
        ],
      },
    ],
  },
  {
    id: "clause-13",
    title: "13. Indemnity",
    subSections: [
      {
        id: "clause-13-1",
        title: "13.1 User Indemnity",
        items: [
          "13.1.1 The User indemnifies and holds harmless the Provider, its members, employees, contractors, and agents against any and all losses, damages, claims, demands, liabilities, costs, and expenses (including reasonable legal costs on an attorney-and-client scale) arising from or in connection with:",
          "a) the User's use of the Application or Services;",
          "b) any User Content or Employee Data uploaded, processed, or stored on the Application;",
          "c) any breach of these Terms by the User or any sub-user; or",
          "d) any allegation that the User Content or Employee Data infringes the rights of a third party or violates applicable law.",
        ],
      },
      {
        id: "clause-13-2",
        title: "13.2 Third-Party Claims",
        items: [
          "13.2.1 The indemnity in this clause includes, without limitation, claims brought by employees, domestic workers, regulators, or other third parties arising from the User's use of Documents generated through the Application.",
        ],
      },
      {
        id: "clause-13-3",
        title: "13.3 Survival",
        items: [
          "13.3.1 The provisions of this clause shall survive termination of these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-14",
    title: "14. Consumer Protection Act Notice",
    subSections: [
      {
        id: "clause-14-1",
        title: "14.1 Attention to Risk and Limitation Provisions",
        items: [
          "14.1.1 The User's attention is expressly drawn to clauses in these Terms which:",
          "a) limit the liability of the Provider;",
          "b) exclude or limit warranties;",
          "c) require the User to assume certain risks; and",
          "d) impose indemnity obligations on the User.",
          "14.1.2 The User acknowledges that such provisions are fair, reasonable, and necessary to protect the Provider's legitimate business interests.",
        ],
      },
      {
        id: "clause-14-2",
        title: "14.2 Assumption of Risk",
        items: [
          "14.2.1 The User acknowledges that the use of the Application and reliance on Documents generated through the Services involve inherent risks.",
          "14.2.2 The User accepts such risks and agrees that the Provider shall not be liable for loss or damage arising from such use, to the extent permitted by applicable law.",
        ],
      },
      {
        id: "clause-14-3",
        title: "14.3 Compliance With Section 49",
        items: [
          "14.3.1 This clause is intended to comply with section 49 of the Consumer Protection Act 68 of 2008, and the User confirms that the provisions referred to herein have been drawn to his or her attention in a conspicuous manner prior to acceptance of these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-15",
    title: "15. Force Majeure",
    subSections: [
      {
        id: "clause-15-1",
        title: "15.1 Force Majeure Events",
        items: [
          "15.1.1 The Provider shall not be liable for any failure or delay in the performance of its obligations under these Terms where such failure or delay arises from events beyond its reasonable control, including but not limited to acts of God, fire, flood, drought, war, terrorism, civil unrest, labour disputes, power failures, internet or telecommunications failures, government action, or failures of third-party service providers.",
        ],
      },
      {
        id: "clause-15-2",
        title: "15.2 Effect of Force Majeure",
        items: [
          "15.2.1 During the continuance of a force majeure event, the Provider's obligations under these Terms shall be suspended to the extent affected by such event.",
          "15.2.2 The Provider shall use reasonable efforts to resume performance as soon as reasonably practicable after the cessation of the force majeure event.",
        ],
      },
      {
        id: "clause-15-3",
        title: "15.3 No Termination for Force Majeure",
        items: [
          "15.3.1 A force majeure event shall not constitute a breach of these Terms and shall not give rise to any right of termination or claim for damages by the User.",
        ],
      },
    ],
  },
  {
    id: "clause-16",
    title: "16. Eligibility and Authority",
    subSections: [
      {
        id: "clause-16-1",
        title: "16.1 Eligibility",
        items: [
          "16.1.1 The Application and Services are intended for use by persons who are at least 18 (eighteen) years of age and who have the legal capacity to enter into binding agreements.",
          "16.1.2 The Application is not intended for use by minors, and the Provider does not knowingly permit access by persons who lack legal capacity.",
        ],
      },
      {
        id: "clause-16-2",
        title: "16.2 Authority to Act",
        items: [
          "16.2.1 Where a User registers for or uses the Application on behalf of a business, employer, or household, the User warrants that he or she has the necessary authority to act on behalf of and bind such entity to these Terms.",
          "16.2.2 The Provider shall be entitled to rely on any representation of authority made by the User and shall not be required to verify such authority.",
        ],
      },
      {
        id: "clause-16-3",
        title: "16.3 Responsibility for Access",
        items: [
          "16.3.1 The User remains responsible for ensuring that all access to and use of the Application under the User's account is lawful and authorised.",
        ],
      },
    ],
  },
  {
    id: "clause-17",
    title: "17. Confidentiality",
    subSections: [
      {
        id: "clause-17-1",
        title: "17.1 Confidential Information",
        items: [
          "17.1.1 For purposes of these Terms, \"Confidential Information\" includes all non-public information relating to the Application, the Services, the Provider's systems, processes, pricing, security measures, documentation, and any User Content or Employee Data not lawfully in the public domain.",
        ],
      },
      {
        id: "clause-17-2",
        title: "17.2 Confidentiality Obligations",
        items: [
          "17.2.1 Each party undertakes to keep the other party's Confidential Information strictly confidential and not to disclose such information to any third party, except as permitted in terms of these Terms or required by law.",
          "17.2.2 The User shall take reasonable steps to prevent unauthorised access to or disclosure of Confidential Information accessed through the Application.",
        ],
      },
      {
        id: "clause-17-3",
        title: "17.3 Permitted Disclosures",
        items: [
          "17.3.1 Confidential Information may be disclosed where required by law, regulation, or court order, provided that reasonable steps are taken to limit the scope of such disclosure.",
        ],
      },
      {
        id: "clause-17-4",
        title: "17.4 Survival",
        items: [
          "17.4.1 The obligations contained in this clause shall survive termination of these Terms.",
        ],
      },
    ],
  },
  {
    id: "clause-18",
    title: "18. Amendments to Terms",
    subSections: [
      {
        id: "clause-18-1",
        title: "18.1 Right to Amend",
        items: [
          "18.1.1 The Provider reserves the right to amend, update, or replace these Terms from time to time.",
          "18.1.2 Any amendments to these Terms shall be published on the Application or otherwise made available to the User.",
        ],
      },
      {
        id: "clause-18-2",
        title: "18.2 Notice and Acceptance",
        items: [
          "18.2.1 Where an amendment materially affects the User's rights or obligations, the Provider shall take reasonable steps to notify the User of such amendment.",
          "18.2.2 Continued access to or use of the Application after the effective date of any amendment shall constitute acceptance of the amended Terms.",
        ],
      },
      {
        id: "clause-18-3",
        title: "18.3 No Retrospective Effect",
        items: [
          "18.3.1 Amendments to these Terms shall not apply retrospectively to the extent prohibited by applicable law.",
        ],
      },
    ],
  },
  {
    id: "clause-19",
    title: "19. Governing Law and Jurisdiction",
    subSections: [
      {
        id: "clause-19-1",
        title: "19.1 Governing Law",
        items: [
          "19.1.1 These Terms shall be governed by and construed in accordance with the laws of the Republic of South Africa.",
        ],
      },
      {
        id: "clause-19-2",
        title: "19.2 Jurisdiction",
        items: [
          "19.2.1 The User irrevocably consents to the jurisdiction of the courts of the Republic of South Africa in respect of any dispute arising out of or in connection with these Terms or the use of the Application.",
          "19.2.2 Nothing in these Terms shall prevent the Provider from instituting proceedings in any other court of competent jurisdiction where appropriate.",
        ],
      },
    ],
  },
  {
    id: "clause-20",
    title: "20. Dispute Resolution",
    subSections: [
      {
        id: "clause-20-1",
        title: "20.1 Good Faith Negotiation",
        items: [
          "20.1.1 In the event of any dispute arising out of or in connection with these Terms or the use of the Application, the parties shall first attempt to resolve the dispute through good faith negotiations.",
        ],
      },
      {
        id: "clause-20-2",
        title: "20.2 Escalation",
        items: [
          "20.2.1 If the dispute is not resolved within a reasonable period after commencement of negotiations, either party may refer the dispute to the courts of competent jurisdiction in accordance with Clause 19.",
        ],
      },
      {
        id: "clause-20-3",
        title: "20.3 No Waiver of Rights",
        items: [
          "20.3.1 Nothing in this clause shall prevent either party from seeking urgent or interim relief from a court of competent jurisdiction.",
        ],
      },
    ],
  },
  {
    id: "clause-21",
    title: "21. Severability, Waiver, and Entire Agreement",
    subSections: [
      {
        id: "clause-21-1",
        title: "21.1 Severability",
        items: [
          "21.1.1 If any provision of these Terms is found to be unlawful, invalid, or unenforceable, such provision shall be severed from the remaining Terms, which shall continue to be of full force and effect.",
        ],
      },
      {
        id: "clause-21-2",
        title: "21.2 Waiver",
        items: [
          "21.2.1 No failure or delay by the Provider to exercise any right or remedy under these Terms shall constitute a waiver of that right or remedy.",
          "21.2.2 Any waiver shall be valid only if reduced to writing and signed by the Provider.",
        ],
      },
      {
        id: "clause-21-3",
        title: "21.3 Entire Agreement",
        items: [
          "21.3.1 These Terms constitute the entire agreement between the User and the Provider relating to the subject matter hereof and supersede all prior agreements, representations, or understandings, whether written or oral.",
        ],
      },
    ],
  },
  {
    id: "clause-22",
    title: "22. Electronic Communications and Notices",
    subSections: [
      {
        id: "clause-22-1",
        title: "22.1 Electronic Communications",
        items: [
          "22.1.1 The User consents to receiving all communications, notices, and documents from the Provider electronically via the Application, email, or other electronic means.",
          "22.1.2 The User acknowledges that electronic communications shall satisfy any legal requirement that such communications be in writing in terms of the Electronic Communications and Transactions Act 25 of 2002.",
        ],
      },
      {
        id: "clause-22-2",
        title: "22.2 Notices",
        items: [
          "22.2.1 Any notice required to be given in terms of these Terms shall be deemed to have been received if sent to the email address associated with the User's account.",
          "22.2.2 The Provider may update its contact details by publishing such changes on the Application.",
        ],
      },
    ],
  },
  {
    id: "clause-23",
    title: "23. Contact Details",
    subSections: [
      {
        id: "clause-23-1",
        title: "23.1 Provider Information",
        items: [
          "23.1.1 The Provider's details for purposes of legal notices and correspondence are as follows:",
          "The Labour Law Association South Africa CC",
          "support@nudoc.co.za",
        ],
      },
    ],
  },
];

const TermsAndConditions = () => {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean) as HTMLElement[];

    if (!targets.length) return;

    let rafId: number | null = null;
    const offset = 120;

    const updateActive = () => {
      rafId = null;
      let current = targets[0].id;
      for (const target of targets) {
        const top = target.getBoundingClientRect().top - offset;
        if (top <= 0) {
          current = target.id;
        } else {
          break;
        }
      }
      setActiveSection(current);
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateActive);
    };

    updateActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const handleScrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const splitClauseItem = (text: string) => {
    const match = text.match(/^(\S+)\s+(.*)$/);
    if (!match) return { label: "", body: text };
    return { label: match[1], body: match[2] };
  };

  return (
    <div className="relative min-h-screen text-slate-900 before:fixed before:inset-0 before:-z-10 before:bg-[url('/AuthImage2.png')] before:bg-cover before:bg-center before:bg-no-repeat before:blur-md before:scale-105 after:fixed after:inset-0 after:-z-10 after:bg-white/25">
      <header className="sticky top-0 z-30 border-b border-white/30 bg-white/45 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Link
              to="/auth?new=1"
              className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/45 px-3 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.35)] backdrop-blur-2xl transition hover:border-blue-200 hover:text-blue-700"
            >
              Back to sign up
            </Link>
          </div>
          <div className="rounded-full border border-white/40 bg-white/40 px-4 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.3)] backdrop-blur-2xl">
            Last updated: 15 January 2026
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-4 pb-16 lg:grid-cols-[300px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:-mt-6 lg:-translate-y-0.5 lg:self-start">
          <div className="rounded-2xl border border-white/[0.6] bg-white/[0.6] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35),0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="pl-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 lg:pl-2">
              Clauses
            </p>
            <nav
              aria-label="Terms clause navigation"
              className="mt-2 flex gap-1.5 overflow-x-auto pb-2 text-xs lg:flex-col lg:overflow-visible"
            >
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleScrollTo(section.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`whitespace-nowrap border px-2.5 py-1 text-left text-[0.7rem] font-semibold leading-tight transition lg:border-none lg:px-2 lg:py-1 ${
                      isActive
                        ? "rounded-sm border-blue-300 bg-white/80 text-blue-700 shadow-[0_6px_14px_rgba(37,99,235,0.18)] lg:rounded-sm lg:bg-white/60"
                        : "rounded-full border-white/40 bg-white/40 text-slate-500 hover:border-slate-300 hover:text-slate-900 lg:rounded-md lg:bg-transparent"
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[0.6] bg-white/[0.6] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35),0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="text-4xl font-bold tracking-[0.1em] text-blue-700">
              Terms & Conditions
            </p>
            <p className="mt-3 text-xs text-slate-900 sm:text-sm">
              This page summarises the terms and conditions for using the Nudoc platform.
            </p>
          </section>

          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 rounded-2xl border border-white/[0.6] bg-white/[0.6] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35),0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
            >
              {(() => {
                const { label, body } = splitClauseItem(section.title);
                if (!label) {
                  return <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>;
                }
                return (
                  <div className="grid grid-cols-[3.5rem_1fr] gap-2">
                    <span className="text-lg font-semibold text-slate-900">{label}</span>
                    <h2 className="text-lg font-semibold text-slate-900">{body}</h2>
                  </div>
                );
              })()}
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                {section.subSections.map((subSection) => (
                  <div key={subSection.id} id={subSection.id} className="space-y-2">
                    {(() => {
                      const { label, body } = splitClauseItem(subSection.title);
                      const headingClass = "text-slate-800";
                      if (!label) {
                        return (
                          <h3 className={`text-sm font-semibold ${headingClass}`}>
                            {subSection.title}
                          </h3>
                        );
                      }
                      return (
                        <div className="grid grid-cols-[3.5rem_1fr] gap-2">
                          <span className={`text-sm font-semibold ${headingClass}`}>{label}</span>
                          <h3 className={`text-sm font-semibold ${headingClass}`}>{body}</h3>
                        </div>
                      );
                    })()}
                    {subSection.intro && (
                      <div className="grid grid-cols-[3.5rem_1fr] gap-2">
                        <span aria-hidden="true" />
                        <p className="text-slate-900" style={{ textAlign: "justify", textAlignLast: "left" }}>
                          {subSection.intro}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {subSection.items.map((item) => {
                        const { label, body } = splitClauseItem(item);
                        if (!label) {
                          return (
                            <p
                              key={item}
                              className="text-slate-900 leading-relaxed"
                              style={{ textAlign: "justify", textAlignLast: "left" }}
                            >
                              {item}
                            </p>
                          );
                        }
                        return (
                          <div key={item} className="grid grid-cols-[3.5rem_1fr] gap-2">
                            <span className="text-slate-900">{label}</span>
                            <p
                              className="text-slate-900 leading-relaxed"
                              style={{ textAlign: "justify", textAlignLast: "left" }}
                            >
                              {body}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center">
        <Link
          to="/auth?new=1"
          className="pointer-events-auto relative rounded-full border border-white/50 bg-white/50 px-6 py-3 text-sm font-semibold text-blue-900 shadow-[0_12px_30px_rgba(30,64,175,0.4)] backdrop-blur-2xl transition hover:bg-white/65"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_3px_10px_rgba(59,130,246,0.35),0_-3px_10px_rgba(59,130,246,0.2)]" aria-hidden="true"></span>
          <span className="relative">Back to Sign Up</span>
        </Link>
      </div>
    </div>
  );
};

export default TermsAndConditions;
