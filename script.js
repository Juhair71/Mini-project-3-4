const API_KEY = 'dc42229e';
const BASE_URL = 'https://www.omdbapi.com/';
const FALLBACK_POSTER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="445" viewBox="0 0 300 445"><rect width="300" height="445" fill="#1f2937"/><text x="50%" y="50%" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">No Poster</text></svg>'
  );

// Suggested titles shown on initial load
const SUGGESTED_TITLES = [
  'Inception',
  'Interstellar',
  'The Dark Knight',
  'Breaking Bad',
  'Dune',
  'Avatar',
  'Sherlock',
  'Parasite'
];

// State
let currentMovies = [];
let watchlist = JSON.parse(localStorage.getItem('cineVaultWatchlist')) || [];
let currentTheme = localStorage.getItem('cineVaultTheme') || 'dark';

// DOM Elements
const sectionTitle = document.getElementById('section-title');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const sortSelect = document.getElementById('sort-select');
const themeToggle = document.getElementById('theme-toggle');
const movieGrid = document.getElementById('movie-grid');
const statusMessage = document.getElementById('status-message');
const watchlistContainer = document.getElementById('watchlist-container');
const watchlistCount = document.getElementById('watchlist-count');
const clearWatchlistBtn = document.getElementById('clear-watchlist');
const movieModal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');

// Initialize with suggested movies
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  renderWatchlist();
  loadSuggestedMovies();
});

// Theme Toggle
themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cineVaultTheme', currentTheme);
  applyTheme(currentTheme);
});

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

// Event Listeners
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    fetchMovies(query);
  }
});

typeFilter.addEventListener('change', renderMovies);
sortSelect.addEventListener('change', renderMovies);

clearWatchlistBtn.addEventListener('click', () => {
  watchlist = [];
  saveWatchlist();
  renderWatchlist();
  renderMovies();
});

closeModalBtn.addEventListener('click', () => {
  movieModal.classList.add('hidden');
});

movieModal.addEventListener('click', (e) => {
  if (e.target === movieModal) {
    movieModal.classList.add('hidden');
  }
});

// Load Suggested Movies on First Open
async function loadSuggestedMovies() {
  sectionTitle.textContent = 'Good movies make your life better';
  showStatus('Loading suggestions...', false);
  movieGrid.innerHTML = '';

  try {
    const requests = SUGGESTED_TITLES.map((title) =>
      fetch(`${BASE_URL}?apikey=${API_KEY}&t=${encodeURIComponent(title)}`).then((res) => res.json())
    );
    const results = await Promise.all(requests);
    currentMovies = results.filter((item) => item && item.Response === 'True');

    if (currentMovies.length > 0) {
      hideStatus();
      renderMovies();
    } else {
      showStatus('No suggestions available right now.', false);
    }
  } catch (error) {
    showStatus('Could not load suggestions.', true);
  }
}

// Async Fetch with Loading, Empty & Error States
async function fetchMovies(query) {
  sectionTitle.textContent = 'Good movies make your life better';
  showStatus('Loading...', false);
  movieGrid.innerHTML = '';

  try {
    const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }

    const data = await response.json();

    if (data.Response === 'False') {
      currentMovies = [];
      showStatus(data.Error || 'No results found. Try another keyword.', false);
      return;
    }

    currentMovies = data.Search;
    hideStatus();
    renderMovies();
  } catch (error) {
    currentMovies = [];
    showStatus(`Error fetching data: ${error.message}`, true);
  }
}

function parseStartYear(yearStr) {
  const match = String(yearStr || '').match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

// Filter, Sort & Render
function renderMovies() {
  if (currentMovies.length === 0) {
    movieGrid.innerHTML = '';
    return;
  }

  const selectedType = typeFilter.value;
  const sortBy = sortSelect.value;

  let list =
    selectedType === 'all'
      ? [...currentMovies]
      : currentMovies.filter((m) => m.Type === selectedType);

  if (sortBy === 'newest') {
    list.sort((a, b) => parseStartYear(b.Year) - parseStartYear(a.Year));
  } else if (sortBy === 'oldest') {
    list.sort((a, b) => parseStartYear(a.Year) - parseStartYear(b.Year));
  } else if (sortBy === 'title-asc') {
    list.sort((a, b) => a.Title.localeCompare(b.Title));
  }

  if (list.length === 0) {
    movieGrid.innerHTML = '';
    showStatus('No results match your current filter.', false);
    return;
  }

  hideStatus();

  movieGrid.innerHTML = list
    .map((movie) => {
      const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : FALLBACK_POSTER;
      const isSaved = watchlist.some((item) => item.imdbID === movie.imdbID);

      return `
        <article class="movie-card">
          <div class="poster-frame">
            <img src="${poster}" alt="${movie.Title}" loading="lazy" />
          </div>
          <div class="card-body">
            <h3 class="card-title">${movie.Title}</h3>
            <p class="card-meta">${movie.Year} • ${movie.Type}</p>
            <div class="card-actions">
              <button class="btn btn-details" data-id="${movie.imdbID}">Details</button>
              <button class="btn btn-save ${isSaved ? 'saved' : ''}" data-id="${movie.imdbID}">
                ${isSaved ? 'Saved' : '+ Watchlist'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

movieGrid.addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('btn-details')) {
    fetchMovieDetails(id);
  } else if (e.target.classList.contains('btn-save')) {
    toggleWatchlist(id);
  }
});

async function fetchMovieDetails(imdbID) {
  modalBody.innerHTML = '<p>Loading details...</p>';
  movieModal.classList.remove('hidden');

  try {
    const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${imdbID}&plot=full`);
    const movie = await response.json();

    if (movie.Response === 'False') {
      modalBody.innerHTML = '<p>Could not load details.</p>';
      return;
    }

    const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : FALLBACK_POSTER;

    modalBody.innerHTML = `
      <div class="modal-grid">
        <div class="modal-poster-box">
          <img src="${poster}" alt="${movie.Title}" />
        </div>
        <div class="modal-details">
          <h2>${movie.Title} (${movie.Year})</h2>
          <p><strong>Genre:</strong> ${movie.Genre}</p>
          <p><strong>Director:</strong> ${movie.Director}</p>
          <p><strong>Actors:</strong> ${movie.Actors}</p>
          <p><strong>IMDb Rating:</strong> ⭐ ${movie.imdbRating}/10</p>
          <p><strong>Plot:</strong> ${movie.Plot}</p>
        </div>
      </div>
    `;
  } catch (error) {
    modalBody.innerHTML = `<p>Failed to load details: ${error.message}</p>`;
  }
}

// Watchlist & Watched Status in LocalStorage
function toggleWatchlist(imdbID) {
  const exists = watchlist.find((item) => item.imdbID === imdbID);

  if (exists) {
    watchlist = watchlist.filter((item) => item.imdbID !== imdbID);
  } else {
    const movieToAdd = currentMovies.find((item) => item.imdbID === imdbID);
    if (movieToAdd) {
      watchlist.push({ ...movieToAdd, watched: false });
    }
  }

  saveWatchlist();
  renderWatchlist();
  renderMovies();
}

function saveWatchlist() {
  localStorage.setItem('cineVaultWatchlist', JSON.stringify(watchlist));
}

function renderWatchlist() {
  watchlistCount.textContent = watchlist.length;

  if (watchlist.length === 0) {
    watchlistContainer.innerHTML = '<p class="empty-watchlist">No titles saved yet.</p>';
    return;
  }

  watchlistContainer.innerHTML = watchlist
    .map((movie) => {
      const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : FALLBACK_POSTER;
      return `
        <div class="watchlist-item">
          <img src="${poster}" alt="${movie.Title}" />
          <div class="watchlist-info">
            <h4>${movie.Title}</h4>
            <span>${movie.Year}</span>
          </div>
          <div class="watchlist-actions">
            <button class="btn-watched ${movie.watched ? 'done' : ''}" data-id="${movie.imdbID}">
              ${movie.watched ? 'Watched' : 'Mark Seen'}
            </button>
            <button class="btn-remove" data-id="${movie.imdbID}">Remove</button>
          </div>
        </div>
      `;
    })
    .join('');
}

watchlistContainer.addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('btn-watched')) {
    watchlist = watchlist.map((item) =>
      item.imdbID === id ? { ...item, watched: !item.watched } : item
    );
    saveWatchlist();
    renderWatchlist();
  } else if (e.target.classList.contains('btn-remove')) {
    watchlist = watchlist.filter((item) => item.imdbID !== id);
    saveWatchlist();
    renderWatchlist();
    renderMovies();
  }
});

function showStatus(message, isError) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden');
  statusMessage.classList.toggle('error', isError);
}

function hideStatus() {
  statusMessage.classList.add('hidden');
}
