# WebDex Entity Schema

## 8 Entity Categories

### Contact
Named people with roles and contact methods.
Fields: name, role, email, phone, department, seniority

### Organisation
Businesses, institutions, government bodies.
Fields: name, type, industry, address, phone, website, abn, accreditations, employees, operatingHours, serviceArea

### Product
Offerings with pricing and specifications.
Fields: name, provider, productType, price {amount, currency, qualifier}, specs, warranty, rating {score, count}, availability, finance

### Action
Forms, APIs, booking systems — the unique WebDex category.
Fields: type, purpose, endpoint, method, contentType, fields[], hiddenFields, submitLabel, successRate, responseHandling

### Location
Physical locations with addresses and coordinates.
Fields: address, suburb, postcode, state, country, lat, lng, locationType, name

### Event
Time-bound entities and deadlines.
Fields: name, date, time, type, registrationUrl, deadline, audience[]

### Review
Aggregated ratings and review data.
Fields: subject, sources[], overallRating, totalReviews, sentiment {positive[], negative[], trending}

### Regulation
Legal requirements and compliance rules.
Fields: name, jurisdiction, authority, appliesTo[], rule, effectiveDate, lastUpdated, source

## Entity Relationships
- works_at: Contact → Organisation
- located_at: Organisation → Location
- offers: Organisation → Product
- has_action: Organisation → Action
- reviewed_by: Organisation → Review
- regulated_by: Product → Regulation
- hosts_event: Organisation → Event
