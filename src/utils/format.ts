export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

// For money someone is about to pay out: exact to the paisa. `currency` above
// rounds to whole rupees — fine for a summary, wrong for an amount that gets
// typed into Razorpay (₹442.50 must not read ₹443).
export const exactCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export const formatDateTime = (value?: string | number | Date) => {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export const formatDate = (value?: string | number | Date) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString();
};

export const sanitize = (value: string) => value.trim();
