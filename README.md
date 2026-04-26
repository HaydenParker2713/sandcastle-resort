# Sandcastle Resort - Phase 1

This is Phase 1 of the Sandcastle Resort Database-Driven Web Application capstone project.

## Features Included
- User registration
- User login/logout
- Session-based authentication
- View resort units
- Create reservations
- Prevent double-booking
- Auto-create invoice for reservation
- Simple frontend pages

## Technologies
- Node.js
- Express.js
- MySQL
- HTML/CSS/JavaScript

## Setup Instructions

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in your database credentials in `.env`.

### 3. Set up the database
Import `schema.sql` into your MySQL instance:
```bash
mysql -u root -p sandcastle_resort < schema.sql
```

### 4. Start the server
```bash
node server.js
```
