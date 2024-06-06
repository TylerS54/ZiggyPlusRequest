const mov_sec = '7d35ad4e705bc608347860298023d6d5'; 
const tok = '7394832212:AAGi9nInkJYeK-YeyeU-_n8wc9G3YtGELNg';

let currentPage = 1;
let totalPages = 1;
let currentQuery = '';

async function searchTMDB() {
    currentPage = 1;
    const input = document.getElementById('imdbInput').value;
    currentQuery = input;
    const mediaType = document.querySelector('input[name="mediaType"]:checked').value;
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';  // Clear previous results
    document.querySelector('.results-container').style.display = 'none';  // Hide results container
    await loadResults(input, mediaType);
    document.querySelector('.results-container').style.display = 'block';  // Show results container
    document.querySelector('.container').classList.remove('small');  // Expand container
    document.querySelector('.container').classList.add('large');  // Expand container
}

async function loadResults(query, mediaType) {
    const resultsContainer = document.getElementById('results');

    try {
        let combinedResults = [];
        if (mediaType === 'both' || mediaType === 'movie') {
            const movieResponse = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${mov_sec}&query=${encodeURIComponent(query)}&page=${currentPage}`);
            const movieData = await movieResponse.json();
            combinedResults = [...combinedResults, ...(movieData.results || [])];
            totalPages = movieData.total_pages;
        }
        if (mediaType === 'both' || mediaType === 'tv') {
            const tvResponse = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${mov_sec}&query=${encodeURIComponent(query)}&page=${currentPage}`);
            const tvData = await tvResponse.json();
            combinedResults = [...combinedResults, ...(tvData.results || [])];
            totalPages = Math.max(totalPages, tvData.total_pages);
        }

        if (combinedResults.length > 0) {
            combinedResults.forEach(async (result) => {
                let detailedResponse;
                let detailedData;
                let mediaType = 'movie';
                if (result.title) {
                    detailedResponse = await fetch(`https://api.themoviedb.org/3/movie/${result.id}?api_key=${mov_sec}`);
                    detailedData = await detailedResponse.json();
                } else if (result.name) {
                    detailedResponse = await fetch(`https://api.themoviedb.org/3/tv/${result.id}?api_key=${mov_sec}`);
                    detailedData = await detailedResponse.json();
                    detailedData.seasons_count = detailedData.number_of_seasons;  // Adding seasons count to detailedData

                    // Determine year range
                    const firstYear = detailedData.first_air_date ? detailedData.first_air_date.split('-')[0] : 'Unknown';
                    const lastYear = detailedData.last_air_date ? detailedData.last_air_date.split('-')[0] : new Date().getFullYear();
                    detailedData.year_range = `${firstYear}-${lastYear}`;

                    mediaType = 'TV Show';
                }

                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                const details = JSON.stringify({
                    title: detailedData.title || detailedData.name,
                    year: detailedData.release_date ? detailedData.release_date.split('-')[0] : detailedData.year_range,
                    type: mediaType,
                    overview: detailedData.overview,
                    poster: `https://image.tmdb.org/t/p/w500${detailedData.poster_path}`,
                    studio: detailedData.production_companies.length > 0 ? detailedData.production_companies[0].name : '',
                    seasons: detailedData.seasons_count
                }).replace(/'/g, "&apos;").replace(/"/g, '&quot;');
                
                resultItem.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w500${detailedData.poster_path}" alt="${detailedData.title || detailedData.name}">
                    <div>
                        <h2>${detailedData.title || detailedData.name}</h2>
                        <p>Year: ${detailedData.release_date ? detailedData.release_date.split('-')[0] : detailedData.year_range}</p>
                        <p>Type: ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}</p>
                        ${mediaType === 'TV Show' ? `<p>Seasons: ${detailedData.seasons_count}</p>` : ''}
                        ${mediaType === 'TV Show' && detailedData.seasons_count > 1 ? `
                        <select class="multi-select" id="seasonSelect-${detailedData.id}" multiple="multiple">
                            ${Array.from({ length: detailedData.seasons_count }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
                        </select>
                        ` : ''}
                        <p>${detailedData.overview}</p>
                        <button class="ziggyButton" data-details="${details}" onclick='sendToTelegram(this, ${detailedData.id})'>Ziggy+ Request This</button>
                        <div class="loading-icon" style="display:none;"></div>
                        <div class="success-icon" style="display:none;">&#10004;</div>
                        <div class="error-icon" style="display:none;">&#10008;</div>
                    </div>
                `;
                resultsContainer.appendChild(resultItem);
                
                // Initialize Select2
                $(`#seasonSelect-${detailedData.id}`).select2({
                    placeholder: "Select Seasons",
                    allowClear: true,
                    closeOnSelect: false
                });
                
            });
        } else if (currentPage === 1) {
            const noResults = document.createElement('div');
            noResults.className = 'result-item';
            noResults.textContent = 'Movie/TV show not found';
            resultsContainer.appendChild(noResults);
        }
    } catch (error) {
        console.error('Error fetching TMDb data:', error);
    }
}

async function checkIfMovieExists(title, studio, year) {
    const url = `https://96-245-100-126.4730d278dc5048d9affc7bebed62465b.plex.direct:32400/library/sections/3/all?title=${encodeURIComponent(title)}&studio=${encodeURIComponent(studio)}&year=${year}&X-Plex-Token=8zALx-Umqn4tWkSJdsBT`;
    const response = await fetch(url);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const size = xmlDoc.getElementsByTagName('MediaContainer')[0].getAttribute('size');
    return size > 0;
}

async function checkIfTVShowExists(title) {
    const url = `https://96-245-100-126.4730d278dc5048d9affc7bebed62465b.plex.direct:32400/library/sections/2/all?title=${encodeURIComponent(title)}&X-Plex-Token=8zALx-Umqn4tWkSJdsBT`;
    const response = await fetch(url);
    const xmlText = await response.text();
    console.log('XML Response:', xmlText); // Log the response for debugging
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const size = xmlDoc.getElementsByTagName('MediaContainer')[0].getAttribute('size');
    if (size > 0) {
        const ratingKey = xmlDoc.getElementsByTagName('Directory')[0].getAttribute('ratingKey');
        console.log('Rating Key:', ratingKey); // Log the rating key for debugging
        return ratingKey;
    }
    return null;
}

async function checkIfSeasonsExist(ratingKey, seasons) {
    const url = `https://96-245-100-126.4730d278dc5048d9affc7bebed62465b.plex.direct:32400/library/metadata/${ratingKey}/children?X-Plex-Token=8zALx-Umqn4tWkSJdsBT`;
    const response = await fetch(url);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const existingSeasons = Array.from(xmlDoc.getElementsByTagName('Directory')).map(dir => parseInt(dir.getAttribute('index')));
    const missingSeasons = seasons.filter(season => !existingSeasons.includes(parseInt(season)));
    return missingSeasons;
}

async function sendToTelegram(buttonElement, id) {
    const detailsString = buttonElement.getAttribute('data-details');
    if (!detailsString) {
        console.error('No details found for the selected item.');
        return;
    }
    
    const details = JSON.parse(detailsString.replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    const { title, studio, year, type } = details;

    console.log('Details:', details);

    let seasonSelect;
    if (type === 'movie') {
        const exists = await checkIfMovieExists(title, studio, year);
        if (exists) {
            alert('Bruh...Did you even check Ziggy+? We have it already.');
            return;
        }
    } else if (type === 'TV Show') {
        seasonSelect = document.getElementById(`seasonSelect-${id}`);
        if (details.seasons > 1 && seasonSelect && seasonSelect.selectedOptions.length === 0) {
            alert('Please select at least one season.');
            return;
        }

        const ratingKey = await checkIfTVShowExists(title);
        console.log('Rating Key:', ratingKey); // Log the rating key for debugging
        if (ratingKey) {
            const selectedSeasons = seasonSelect ? Array.from(seasonSelect.selectedOptions).map(option => option.value) : [];
            console.log('Selected Seasons:', selectedSeasons); // Log selected seasons for debugging
            const missingSeasons = await checkIfSeasonsExist(ratingKey, selectedSeasons);
            console.log('Missing Seasons:', missingSeasons); // Log missing seasons for debugging
            if (missingSeasons.length === 0) {
                alert('Bruh...Did you even check Ziggy+? We have all of the seasons you selected.');
                return;
            } else {
                details.missingSeasons = missingSeasons;
            }
        } else {
            details.missingSeasons = 'All'; // If the show doesn't exist, we need all seasons.
        }
    }

    let selectedSeasons = '';
    if (details.type === 'TV Show') {
        selectedSeasons = seasonSelect ? Array.from(seasonSelect.selectedOptions).map(option => option.value).join(', ') : '';
    }

    const message = `
Title: ${details.title}
Year: ${details.year}
Type: ${details.type}
${details.type === 'TV Show' ? `Seasons: ${details.seasons}\nSelected Seasons: ${selectedSeasons}\nMissing Seasons: ${details.missingSeasons}\n` : ''}
Overview: ${details.overview}
Poster: ${details.poster}
`;

    const loadingIcon = buttonElement.nextElementSibling;
    const successIcon = loadingIcon.nextElementSibling;
    const errorIcon = successIcon.nextElementSibling;

    buttonElement.style.display = 'none';
    loadingIcon.style.display = 'block';

    fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: '-4285186614',  // Replace with your Telegram chat ID
            text: message
        })
    })
    .then(response => response.json())
    .then(data => {
        loadingIcon.style.display = 'none';
        if (data.ok) {
            successIcon.style.display = 'block';
        } else {
            errorIcon.style.display = 'block';
        }
    })
    .catch(error => {
        loadingIcon.style.display = 'none';
        errorIcon.style.display = 'block';
        console.error('Error sending message to Telegram:', error);
    });
}

document.getElementById('imdbInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchTMDB();
    }
});

// Infinite scrolling
const resultsContainer = document.getElementById('resultsContainer');
resultsContainer.addEventListener('scroll', async function() {
    if (resultsContainer.scrollTop + resultsContainer.clientHeight >= resultsContainer.scrollHeight) {
        if (currentPage < totalPages) {
            currentPage++;
            const mediaType = document.querySelector('input[name="mediaType"]:checked').value;
            await loadResults(currentQuery, mediaType);
        }
    }
});
