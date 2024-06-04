const apiKey = '95a8aec';  // Replace with your OMDb API key
const telegramToken = '7394832212:AAGi9nInkJYeK-YeyeU-_n8wc9G3YtGELNg';

async function searchIMDB() {
    const input = document.getElementById('imdbInput').value;
    const result = document.getElementById('result');
    const titleElement = document.getElementById('title');
    const splashArt = document.getElementById('splashArt');
    const typeElement = document.getElementById('type');
    const yearElement = document.getElementById('year');
    const ratingElement = document.getElementById('rating');
    const ziggyButton = document.getElementById('ziggyButton');

    // Determine if input is an IMDB ID or a search query
    let queryParam = '';
    if (input.startsWith('tt')) {
        queryParam = `i=${input}`;
    } else {
        queryParam = `t=${encodeURIComponent(input)}`;
    }

    try {
        const response = await fetch(`http://www.omdbapi.com/?${queryParam}&apikey=${apiKey}`);
        const data = await response.json();

        if (data.Response === "True") {
            titleElement.textContent = data.Title;
            splashArt.src = data.Poster;
            splashArt.style.display = 'block';
            typeElement.textContent = `Type: ${data.Type.charAt(0).toUpperCase() + data.Type.slice(1)}`; // Capitalize first letter
            yearElement.textContent = `Year: ${data.Year}`;
            ratingElement.textContent = `IMDB Rating: ${data.imdbRating}`;

            result.style.display = 'block';
            ziggyButton.style.display = 'inline-block';

            // Store movie details in the button dataset for later use
            ziggyButton.dataset.details = JSON.stringify({
                title: data.Title,
                year: data.Year,
                type: data.Type,
                rating: data.imdbRating,
                poster: data.Poster
            });
        } else {
            titleElement.textContent = 'Movie/TV show not found';
            splashArt.style.display = 'none';
            typeElement.textContent = '';
            yearElement.textContent = '';
            ratingElement.textContent = '';
            ziggyButton.style.display = 'none';

            result.style.display = 'block';
        }
    } catch (error) {
        console.error('Error fetching OMDb data:', error);
    }
}

async function sendToTelegram() {
    const ziggyButton = document.getElementById('ziggyButton');
    const details = JSON.parse(ziggyButton.dataset.details);
    const message = `
Title: ${details.title}
Year: ${details.year}
Type: ${details.type}
IMDB Rating: ${details.rating}
Poster: ${details.poster}
`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: '-4285186614',
                text: message
            })
        });
        const data = await response.json();
        if (data.ok) {
            alert('Request sent successfully!');
        } else {
            alert('Failed to send request.');
        }
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        alert('Failed to send request.');
    }
}

document.getElementById('imdbInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchIMDB();
    }
});
