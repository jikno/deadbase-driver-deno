# Deadbase Driver Deno

A Deno driver for [Deadbase](https://github.com/jikno/deadbase).

## Usage

```ts
import { getInstance } from 'https://deno.land/x/deadbase/mod.ts'

const instance = getInstance('http://localhost:2780')
const database = instance.getDatabase('Vehmloewff.some-database', { auth: 'test-pass' })
const collections = await database.listCollections()
const usersCollection = database.getCollection('users')

// add a new document
await usersCollection.addDocument({ id: '40a', username: 'JohnDoe', password: 'not-real', email: 'john.doe@example.com' })

// get the document we just created by it's id
const johnDoe = await usersCollection.getDocument('40a').load()

// search all documents in the 'users' collection for a document that has a value that matches the regex `/doe/i`
// on a key of 'username'
const johnDoe = await usersCollection.findOneDocument('username', [/doe/i]).then(docId => getDocument(docId).load())

// get the ids of all documents that have a an email at the domains `example.com` or `example.org`
const usersWithFakeEmails = await usersCollection.findManyDocuments('email', [/.+@example\.com/, /.+@example\.org/])
```

Contributions are welcome!
