export function leadg2Contact() {
  return {
    name: process.env.LEADG2_CONTACT_NAME || "LeadG2 Solutions Team",
    title: process.env.LEADG2_CONTACT_TITLE || "Lead Consultant",
    email: process.env.LEADG2_CONTACT_EMAIL || "",
    phone: process.env.LEADG2_CONTACT_PHONE || "",
    website: process.env.LEADG2_CONTACT_WEBSITE || "leadg2.com",
  };
}

