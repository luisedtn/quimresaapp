
const knex = require('knex');
const db = knex({
    client: 'sqlite3',
    connection: {
        filename: 'c:/quimresadesk/data/quimresa.sqlite3'
    },
    useNullAsDefault: true
});

async function main() {
    const result = await db('BASES').columnInfo();
    console.log('BASES columns:', JSON.stringify(result, null, 2));
    await db.destroy();
}
main();
