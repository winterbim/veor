# BIMCheck pilot reference

A separate isolated integration pilot was created in `winterbim/BIMCheck-v3.4` on branch:

`test/veor-mcp-gateway`

The pilot placed a VEOR gateway in front of BIMCheck's existing stdio MCP server and added tests for safe reads, reviewed writes, bounded paths, argument-dependent side effects and one-shot approval semantics.

At the pilot checkpoint used to inform this repository, GitHub Actions run `35724381147` completed successfully on commit `b34052cdf992bbc5848efaaee9f1c76fd49b4247`, including a test that launched the real BIMCheck MCP behind the gateway.

Do not copy BIMCheck-specific policy into the generic kernel. Use it as an integration fixture/reference when building the official SDK transport adapter.
