# SIT725-2025-Wareniex
A smart warehouse stock automation application

## Run locally

Install dependencies and start the server (requires Node.js and MongoDB):

1. Install dependencies:

	npm install

2. Start MongoDB locally (or set MONGO_URI env var), then start app:

	npm run dev

The app will be available at http://localhost:5000 and has a simple products CRUD at /products.

## Quick Starting the App if running locally:

1. Install the dependencies by running:
   npm install mongoose express passport
   npm install socket.io
   npm install pdfkit
   npm install bwip-js

2. Connect the required DB connection (In this case, MongoDB)
   
3. Next Run:
   npm start
   The App can be located at http://localhost:5000 in your default browser
