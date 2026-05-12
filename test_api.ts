async function test() {
    try {
        const res = await fetch('http://localhost:3001/api/componentes/colores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Note: Missing token, but let's see if it even gets to the DB
            },
            body: JSON.stringify({ codigos: ['TEST'] }),
        });
        console.log(await res.json());
    } catch (e) {
        console.error(e);
    }
}
test();
