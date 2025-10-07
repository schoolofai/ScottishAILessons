const sdk = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new sdk.Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);

databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    'lesson_templates',
    '68e1665a002c63f8cce0'
).then(doc => {
    console.log(JSON.stringify(doc, null, 2));
}).catch(err => {
    console.error('Error:', err);
});
