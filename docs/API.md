# WebDex API Documentation

Base URL: `https://api.webdex.ai/v1`
Auth: `X-API-Key: your-key-here`

## Endpoints

### Search
`GET /v1/search?q=solar+installers+perth&category=organisation&limit=20`

### Entity Detail
`GET /v1/entities/:id`

### List Entities
`GET /v1/entities?category=contact&domain=regenpower.com`

### Form Schema
`GET /v1/forms/:action_id`

### Execute Action
`POST /v1/actions/execute` — Body: `{ action_id, data: { field: value } }`

### Assemble Data
`POST /v1/assemble` — Body: `{ categories: [...], location: "perth" }`

### Request Crawl
`POST /v1/crawl` — Body: `{ url: "https://..." }`

### Personal Index
`POST /v1/personal-index` — Body: `{ urls: [...], tier: "basic" }`
`GET /v1/personal-index/:id/status`
`GET /v1/personal-index/:userId/entities`

### Health
`GET /health`
