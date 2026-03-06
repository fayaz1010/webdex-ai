# WebDex MCP Tools

Connect WebDex to any MCP-compatible AI agent (Claude, GPT, etc.)

## Tools

### webdex_search
Search the entity index. Returns structured data about businesses, contacts, products, actions.

### webdex_get_form
Get complete form schema for an action entity including all fields and submission endpoint.

### webdex_submit_form
Execute a form submission via pre-mapped endpoint. No browser needed.

### webdex_assemble
Cross-category data assembly. Build datasets spanning contacts + organisations + products.

### webdex_compare
Side-by-side structured comparison of entities.

## Configuration
```json
{
  "mcpServers": {
    "webdex": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": { "DATABASE_URL": "..." }
    }
  }
}
```
