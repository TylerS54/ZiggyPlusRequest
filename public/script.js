const NAME_KEY = 'ziggyRequestorName';
const POSTER_BASE = 'https://image.tmdb.org/t/p/';

const search = {
    query: '',
    mediaType: 'both',
    currentPage: 1,
    totalPages: 1,
    loading: false,
    id: 0
};

const els = {
    form: document.getElementById('searchForm'),
    input: document.getElementById('imdbInput'),
    clear: document.getElementById('clearSearch'),
    results: document.getElementById('results'),
    loader: document.getElementById('loader'),
    sentinel: document.getElementById('sentinel'),
    nameChip: document.getElementById('nameChip'),
    nameChipLabel: document.getElementById('nameChipLabel'),
    nameDialog: document.getElementById('nameDialog'),
    nameInput: document.getElementById('requestorName'),
    seasonDialog: document.getElementById('seasonDialog'),
    seasonForm: document.getElementById('seasonForm'),
    seasonPoster: document.getElementById('seasonPoster'),
    seasonTitle: document.getElementById('seasonTitle'),
    seasonMeta: document.getElementById('seasonMeta'),
    seasonGrid: document.getElementById('seasonGrid'),
    seasonAll: document.getElementById('seasonAll'),
    seasonSubmit: document.getElementById('seasonSubmit'),
    seasonClose: document.getElementById('seasonClose'),
    toast: document.getElementById('toast')
};

// Storage can throw in private browsing, so treat it as best-effort.
function loadName() {
    try {
        return localStorage.getItem(NAME_KEY) || '';
    } catch (error) {
        return '';
    }
}

function saveName(name) {
    try {
        if (name) {
            localStorage.setItem(NAME_KEY, name);
        } else {
            localStorage.removeItem(NAME_KEY);
        }
    } catch (error) {
        // Not remembered this time; the name still goes with this session's requests.
    }
}

function updateNameChip() {
    const name = els.nameInput.value.trim();
    els.nameChipLabel.textContent = name || 'Add your name';
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function icon(paths) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths;
    return svg;
}

const ICONS = {
    check: '<path d="m5 12 5 5 9-10"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    retry: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'
};

let toastTimer;
function showToast(title, text) {
    els.toast.querySelector('.toast-title').textContent = title;
    els.toast.querySelector('.toast-text').textContent = text;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast.classList.remove('is-visible');
        setTimeout(() => { els.toast.hidden = true; }, 250);
    }, 4500);
}

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
}

async function loadDetails(kind, id) {
    const data = await fetchJSON(`/api/tmdb/${kind}/${id}`);
    const studio = data.production_companies && data.production_companies.length > 0 ? data.production_companies[0].name : '';
    if (kind === 'movie') {
        const year = data.release_date ? data.release_date.split('-')[0] : undefined;
        return {
            title: data.title,
            year,
            type: 'movie',
            overview: data.overview,
            posterPath: data.poster_path,
            studio,
            seasons: undefined,
            meta: year || 'Year unknown'
        };
    }
    const firstYear = data.first_air_date ? data.first_air_date.split('-')[0] : 'Unknown';
    const lastYear = data.last_air_date ? data.last_air_date.split('-')[0] : new Date().getFullYear();
    const seasons = data.number_of_seasons;
    return {
        title: data.name,
        year: `${firstYear}-${lastYear}`,
        type: 'TV Show',
        overview: data.overview,
        posterPath: data.poster_path,
        studio,
        seasons,
        meta: `${firstYear === String(lastYear) ? firstYear : `${firstYear}–${lastYear}`} · ${seasons || '?'} ${seasons === 1 ? 'season' : 'seasons'}`
    };
}

function needsSeasonPicker(item) {
    return item.type === 'TV Show' && item.seasons > 1;
}

function posterNode(item, className) {
    if (!item.posterPath) {
        return el('div', `${className} poster-empty`, item.title);
    }
    const img = el('img', className);
    img.src = `${POSTER_BASE}w342${item.posterPath}`;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
}

function renderCard(item) {
    const card = el('article', 'card');
    card.appendChild(posterNode(item, 'poster'));

    const body = el('div', 'card-body');
    body.appendChild(el('h2', 'card-title', item.title));

    const meta = el('div', 'card-meta');
    meta.appendChild(el('span', 'badge', item.type === 'movie' ? 'Movie' : 'TV'));
    meta.appendChild(el('span', 'card-meta-text', item.meta));
    body.appendChild(meta);

    if (item.overview) {
        const overview = el('p', 'card-overview', item.overview);
        overview.title = 'Tap to read more';
        overview.addEventListener('click', () => overview.classList.toggle('is-expanded'));
        body.appendChild(overview);
    }

    const action = el('div', 'card-action');
    body.appendChild(action);
    card.appendChild(body);

    card.item = item;
    card.action = action;
    setCardState(card, 'ready');
    return card;
}

function setCardState(card, state, selectedSeasons) {
    const item = card.item;
    const action = card.action;
    action.replaceChildren();

    if (state === 'ready') {
        const picker = needsSeasonPicker(item);
        const button = el('button', 'button button-primary', picker ? 'Choose seasons' : 'Request');
        button.type = 'button';
        button.addEventListener('click', () => (picker ? openSeasonPicker(card) : sendRequest(card, [])));
        action.appendChild(button);
    } else if (state === 'sending') {
        const button = el('button', 'button button-busy');
        button.type = 'button';
        button.disabled = true;
        button.append(el('span', 'spinner'), 'Checking Ziggy+…');
        action.appendChild(button);
    } else if (state === 'sent') {
        const status = el('div', 'status status-sent');
        status.append(icon(ICONS.check), 'Requested');
        action.appendChild(status);
    } else if (state === 'exists') {
        const status = el('div', 'status status-exists');
        status.append(icon(ICONS.tv), 'Already on Ziggy+');
        action.appendChild(status);
    } else if (state === 'error') {
        const button = el('button', 'button button-error');
        button.type = 'button';
        button.append(icon(ICONS.retry), "Didn't send. Tap to retry");
        button.addEventListener('click', () => sendRequest(card, selectedSeasons));
        action.appendChild(button);
    }
}

function renderMessage(title, text) {
    const box = el('div', 'message');
    box.appendChild(el('div', 'message-title', title));
    box.appendChild(el('div', 'message-text', text));
    els.results.appendChild(box);
}

async function searchTMDB() {
    const query = els.input.value.trim();
    if (!query) {
        els.input.focus();
        return;
    }
    search.query = query;
    search.mediaType = document.querySelector('input[name="mediaType"]:checked').value;
    search.currentPage = 1;
    search.totalPages = 1;
    search.id++;

    els.results.replaceChildren();
    document.body.classList.remove('is-home');
    document.body.classList.add('has-results');
    els.input.blur();
    window.scrollTo(0, 0);
    await loadResults(search.id);
}

async function loadResults(searchId) {
    search.loading = true;
    els.loader.hidden = false;
    const { query, mediaType, currentPage } = search;
    try {
        const kinds = mediaType === 'both' ? ['movie', 'tv'] : [mediaType];
        const pages = await Promise.all(kinds.map((kind) =>
            fetchJSON(`/api/tmdb/search/${kind}?query=${encodeURIComponent(query)}&page=${currentPage}`)
        ));
        if (searchId !== search.id) return;
        search.totalPages = Math.max(1, ...pages.map((page) => page.total_pages || 0));

        const hits = pages.flatMap((page, i) => (page.results || []).map((result) => ({ kind: kinds[i], id: result.id })));
        // Fetch details in parallel but render in TMDB's order.
        const items = await Promise.all(hits.map((hit) =>
            loadDetails(hit.kind, hit.id).catch((error) => {
                console.error('Error fetching TMDb details:', error);
                return null;
            })
        ));
        if (searchId !== search.id) return;

        items.filter(Boolean).forEach((item) => els.results.appendChild(renderCard(item)));
        if (hits.length === 0 && currentPage === 1) {
            renderMessage(`No matches for "${query}"`, 'Check the spelling, or switch between Movies and TV shows.');
        }
    } catch (error) {
        console.error('Error fetching TMDb data:', error);
        if (searchId === search.id && currentPage === 1) {
            renderMessage("Search isn't working right now", 'Give it a moment and try again.');
        }
    } finally {
        if (searchId === search.id) {
            search.loading = false;
            els.loader.hidden = true;
            maybeLoadMore();
        }
    }
}

// Infinite scrolling: load the next page whenever the bottom of the list comes near the screen.
function maybeLoadMore() {
    if (search.loading || !search.query || search.currentPage >= search.totalPages) return;
    if (els.sentinel.getBoundingClientRect().top > window.innerHeight + 600) return;
    search.currentPage++;
    loadResults(search.id);
}

async function sendRequest(card, selectedSeasons) {
    const item = card.item;
    const requestorName = els.nameInput.value.trim() || 'Anonymous';
    setCardState(card, 'sending');

    try {
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: item.title,
                year: item.year,
                type: item.type,
                studio: item.studio,
                overview: item.overview,
                poster: `${POSTER_BASE}w500${item.posterPath}`,
                seasons: item.seasons,
                selectedSeasons: selectedSeasons,
                requestorName: requestorName
            })
        });
        const data = await response.json();
        if (data.status === 'sent') {
            setCardState(card, 'sent');
        } else if (data.status === 'exists') {
            showToast('Bruh… did you even check Ziggy+?', 'We have it already.');
            // A show with several seasons can still be asked for again with different seasons.
            setCardState(card, needsSeasonPicker(item) ? 'ready' : 'exists');
        } else {
            setCardState(card, 'error', selectedSeasons);
        }
    } catch (error) {
        console.error('Error sending request:', error);
        setCardState(card, 'error', selectedSeasons);
    }
}

// Season picker sheet
let seasonCard = null;
let pickedSeasons = new Set();

function openSeasonPicker(card) {
    const item = card.item;
    seasonCard = card;
    pickedSeasons = new Set();

    const poster = posterNode(item, 'poster poster-small');
    poster.id = 'seasonPoster';
    els.seasonPoster.replaceWith(poster);
    els.seasonPoster = poster;
    els.seasonTitle.textContent = item.title;
    els.seasonMeta.textContent = `TV · ${item.meta}`;

    els.seasonGrid.replaceChildren();
    for (let n = 1; n <= item.seasons; n++) {
        const chip = el('button', 'season-chip', `Season ${n}`);
        chip.type = 'button';
        chip.value = String(n);
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => {
            if (pickedSeasons.has(n)) pickedSeasons.delete(n); else pickedSeasons.add(n);
            updateSeasonPicker();
        });
        els.seasonGrid.appendChild(chip);
    }
    updateSeasonPicker();
    els.seasonDialog.showModal();
}

function updateSeasonPicker() {
    const total = seasonCard.item.seasons;
    const count = pickedSeasons.size;
    els.seasonGrid.querySelectorAll('.season-chip').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(pickedSeasons.has(Number(chip.value))));
    });
    els.seasonAll.textContent = count === total ? 'Clear' : 'Select all';
    els.seasonSubmit.disabled = count === 0;
    if (count === 0) {
        els.seasonSubmit.textContent = 'Pick at least one season';
    } else if (count === total) {
        els.seasonSubmit.textContent = `Request all ${total} seasons`;
    } else {
        els.seasonSubmit.textContent = `Request ${count} ${count === 1 ? 'season' : 'seasons'}`;
    }
}

els.seasonAll.addEventListener('click', () => {
    const total = seasonCard.item.seasons;
    pickedSeasons = pickedSeasons.size === total
        ? new Set()
        : new Set(Array.from({ length: total }, (_, i) => i + 1));
    updateSeasonPicker();
});

els.seasonForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pickedSeasons.size === 0) return;
    const selected = [...pickedSeasons].sort((a, b) => a - b).map(String);
    els.seasonDialog.close();
    sendRequest(seasonCard, selected);
});

els.seasonClose.addEventListener('click', () => els.seasonDialog.close());

// Tapping the dimmed backdrop closes either sheet.
[els.seasonDialog, els.nameDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
});

// Name
els.nameInput.value = loadName();
updateNameChip();

els.nameChip.addEventListener('click', () => {
    els.nameDialog.showModal();
    els.nameInput.focus();
});

els.nameDialog.addEventListener('close', () => {
    const name = els.nameInput.value.trim();
    els.nameInput.value = name;
    saveName(name);
    updateNameChip();
});

// Search
els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    searchTMDB();
});

els.input.addEventListener('input', () => {
    els.clear.hidden = els.input.value === '';
});

els.clear.addEventListener('click', () => {
    els.input.value = '';
    els.clear.hidden = true;
    els.input.focus();
});

document.querySelectorAll('input[name="mediaType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        if (search.query) {
            if (!els.input.value.trim()) els.input.value = search.query;
            searchTMDB();
        }
    });
});

if ('IntersectionObserver' in window) {
    new IntersectionObserver(maybeLoadMore, { rootMargin: '0px 0px 600px 0px' }).observe(els.sentinel);
}
window.addEventListener('scroll', maybeLoadMore, { passive: true });
