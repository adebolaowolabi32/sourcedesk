# Audit records and evidence

## Finding a complete payment history

Open Payment details to view that payment’s own history and processing attempts. Use the page controls to reach older events. This history is queried separately from the latest workspace activity, so older payment events remain accessible.

## External audit retention

Audit records and attempt events reject normal SQL updates and deletes. A database owner can bypass these protections. Stronger retention needs an independently administered archive receiver configured through AUDIT_EXPORT_URL and AUDIT_EXPORT_TOKEN.
