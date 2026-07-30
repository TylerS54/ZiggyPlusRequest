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
            const movieResponse = await fetch(`/api/tmdb/search/movie?query=${encodeURIComponent(query)}&page=${currentPage}`);
            const movieData = await movieResponse.json();
            combinedResults = [...combinedResults, ...(movieData.results || [])];
            totalPages = movieData.total_pages;
        }
        if (mediaType === 'both' || mediaType === 'tv') {
            const tvResponse = await fetch(`/api/tmdb/search/tv?query=${encodeURIComponent(query)}&page=${currentPage}`);
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
                    detailedResponse = await fetch(`/api/tmdb/movie/${result.id}`);
                    detailedData = await detailedResponse.json();
                } else if (result.name) {
                    detailedResponse = await fetch(`/api/tmdb/tv/${result.id}`);
                    detailedData = await detailedResponse.json();
                    detailedData.seasons_count = detailedData.number_of_seasons;  // Adding seasons count
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
                        <button class="ziggyButton" data-details="${details}" onclick='sendRequest(this, ${detailedData.id})'>Ziggy+ Request This</button>
                        <div class="loading-icon" style="display:none;"></div>
                        <div class="success-icon" style="display:none;">&#10004;</div>
                        <div class="error-icon" style="display:none;">&#10008;</div>
                    </div>
                `;
                resultsContainer.appendChild(resultItem);

                // Initialize Select2 for multi-select seasons
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

async function sendRequest(buttonElement, id) {
    const detailsString = buttonElement.getAttribute('data-details');
    if (!detailsString) {
        console.error('No details found for the selected item.');
        return;
    }

    const details = JSON.parse(detailsString.replace(/&quot;/g, '"').replace(/&apos;/g, "'"));

    // Get the requestor's name
    const requestorName = document.getElementById('requestorName').value || 'Anonymous';

    let selectedSeasons = [];
    if (details.type === 'TV Show') {
        const seasonSelect = document.getElementById(`seasonSelect-${id}`);
        if (details.seasons > 1 && seasonSelect && seasonSelect.selectedOptions.length === 0) {
            alert('Please select at least one season.');
            return;
        }
        selectedSeasons = seasonSelect ? Array.from(seasonSelect.selectedOptions).map(option => option.value) : [];
    }

    const loadingIcon = buttonElement.nextElementSibling;
    const successIcon = loadingIcon.nextElementSibling;
    const errorIcon = successIcon.nextElementSibling;

    buttonElement.style.display = 'none';
    loadingIcon.style.display = 'block';

    try {
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: details.title,
                year: details.year,
                type: details.type,
                studio: details.studio,
                overview: details.overview,
                poster: details.poster,
                seasons: details.seasons,
                selectedSeasons: selectedSeasons,
                requestorName: requestorName
            })
        });
        const data = await response.json();
        loadingIcon.style.display = 'none';
        if (data.status === 'sent') {
            successIcon.style.display = 'block';
        } else if (data.status === 'exists') {
            buttonElement.style.display = 'block';
            alert('Bruh...Did you even check Ziggy+? We have it already.');
        } else {
            errorIcon.style.display = 'block';
        }
    } catch (error) {
        loadingIcon.style.display = 'none';
        errorIcon.style.display = 'block';
        console.error('Error sending request:', error);
    }
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
