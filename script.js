const apiKey = '7d35ad4e705bc608347860298023d6d5'; 
const telegramToken = '7394832212:AAGi9nInkJYeK-YeyeU-_n8wc9G3YtGELNg';

async function searchTMDB() {
    const input = document.getElementById('imdbInput').value;
    const result = document.getElementById('result');
    const titleElement = document.getElementById('title');
    const splashArt = document.getElementById('splashArt');
    const typeElement = document.getElementById('type');
    const yearElement = document.getElementById('year');
    const ratingElement = document.getElementById('rating');
    const ziggyButton = document.getElementById('ziggyButton');

    try {
        // Search for movies or TV shows by query
        const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(input)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            // Take the first result as an example
            const firstResult = data.results[0];
            let detailedResponse;
            if (firstResult.media_type === 'movie') {
                detailedResponse = await fetch(`https://api.themoviedb.org/3/movie/${firstResult.id}?api_key=${apiKey}`);
            } else {
                detailedResponse = await fetch(`https://api.themoviedb.org/3/tv/${firstResult.id}?api_key=${apiKey}`);
            }
            const detailedData = await detailedResponse.json();

            titleElement.textContent = detailedData.title || detailedData.name;
            splashArt.src = `https://image.tmdb.org/t/p/w500${detailedData.poster_path}`;
            splashArt.style.display = 'block';
            typeElement.textContent = `Type: ${firstResult.media_type.charAt(0).toUpperCase() + firstResult.media_type.slice(1)}`;
            yearElement.textContent = `Year: ${detailedData.release_date ? detailedData.release_date.split('-')[0] : detailedData.first_air_date.split('-')[0]}`;
            ratingElement.textContent = `TMDb Rating: ${detailedData.vote_average}`;

            result.style.display = 'block';
            ziggyButton.style.display = 'inline-block';

            // Store movie details in the button dataset for later use
            ziggyButton.dataset.details = JSON.stringify({
                title: detailedData.title || detailedData.name,
                year: detailedData.release_date ? detailedData.release_date.split('-')[0] : detailedData.first_air_date.split('-')[0],
                type: firstResult.media_type,
                rating: detailedData.vote_average,
                poster: `https://image.tmdb.org/t/p/w500${detailedData.poster_path}`
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
        console.error('Error fetching TMDb data:', error);
    }
}

async function sendToTelegram() {
    const ziggyButton = document.getElementById('ziggyButton');
    const details = JSON.parse(ziggyButton.dataset.details);
    const message = `
Title: ${details.title}
Year: ${details.year}
Type: ${details.type}
TMDb Rating: ${details.rating}
Poster: ${details.poster}
`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: '-4285186614',  // Replace with your Telegram chat ID
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
        searchTMDB();
    }
});