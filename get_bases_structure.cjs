
const knex = require('knex');
const db = knex({
    client: 'sqlite3',
    connection: {
        filename: 'c:/quimresadesk/data/quimresa.sqlite3'
    },
    useNullAsDefault: true
});

async function main() {
    try {
        const result = await db('BASES').columnInfo();
        console.log('BASES columns:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        await db.destroy();
    }
}
main();
