# Publish checklist

Before any public beta:

- [ ] `npm run check` passes with fresh evidence
- [ ] `npm pack --dry-run` contains no secrets/runtime state
- [ ] official MCP SDK v2 transport gate is green
- [ ] policy JSON Schema validation is green
- [ ] Linux hardened sandbox tests run on a host with the claimed primitives
- [ ] README/security matrix match actual code
- [ ] approval private key is never included in examples or package
- [ ] receipt verification CLI exists
- [ ] SBOM/provenance/release signing configured
- [ ] independent reviewer attacks the boundary and records findings
- [ ] demo shows both a safe allowed action and a risky action blocked *before* downstream effect
