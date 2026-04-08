export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
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
