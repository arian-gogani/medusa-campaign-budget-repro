# Medusa campaign budget reproduction

This repository contains a source-level reproduction for a suspected
`spend_by_attribute` campaign-budget enforcement gap in
[`medusajs/medusa`](https://github.com/medusajs/medusa), pinned to commit
`146c46b0ad1146b40595c8ef586c4d5890982603`.

The scripts bundle and call Medusa's source functions. They do not copy the
budget arithmetic into this repository. Some framework barrels are redirected
through the small `shim/` modules so the probes can load the relevant source
without installing the full Medusa application.

This is not an end-to-end test against a running Medusa server. In particular,
the registration probe replaces database and dependency-injection boundaries
with recorders; the arithmetic and budget guard remain Medusa's code. The SQL
probe checks the relevant schema constraint separately. See
[`HOW-TO-RUN.md`](HOW-TO-RUN.md) for exact scope and reproduction steps.

## Reproduction at a glance

The main probe compares a `spend` budget with a `spend_by_attribute` budget
using the same offered discount. Additional probes record the arithmetic
inputs, exercise the real Admin API Zod validators, inspect the registration
path with persistence replaced by recorders, and check the `max_quantity`
behavior separately. Recorded outputs are checked in alongside each probe.

The finding and its limitations are described in the accompanying Medusa
report. This repository alone does not establish impact in a deployed
installation or test a live HTTP request.
