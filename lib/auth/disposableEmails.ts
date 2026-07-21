// Bloqueo de emails desechables (decisión 7, cicatriz replicada de StressPlan).
// El anti-abuso real es la verificación obligatoria; esto corta de entrada los
// dominios de buzón temporal más comunes antes de mandar un mail que nadie lee.
const BLOCKED_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'yopmail.com',
  'tempmail.com', 'throwam.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org',
  'temp-mail.org', 'fakeinbox.com', 'mailnull.com',
  'spamspot.com', 'spamthis.co.uk', 'spamthisplease.com',
]

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && BLOCKED_DOMAINS.includes(domain)
}
