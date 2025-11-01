// Browser Console Script to Debug "Last Read" Functionality
// Copy and paste this into your browser's developer console while on the homepage

console.log('=== Debugging Last Read Functionality ===');

// Check what's currently stored in localStorage
console.log('Checking localStorage for mokuro_content:');
const stored = localStorage.getItem('mokuro_content');
if (stored) {
  const data = JSON.parse(stored);
  console.log('Stored data:', data);
  console.log('Progress entries:', data.progress);
  console.log('Series entries:', data.series);
  console.log('Chapters entries:', data.chapters);
} else {
  console.log('No data found in mokuro_content');
}

// Create sample reading progress data using the correct key
const sampleData = {
  series: [{
    id: 'ruri-rocks-series',
    title: 'Ruri Rocks',
    author: 'Sample Author',
    description: 'A sample manga series for testing',
    totalChapters: 5,
    status: 'ongoing',
    addedDate: Date.now() - 86400000, // 1 day ago
    lastReadDate: Date.now() - 3600000, // 1 hour ago
  }],
  chapters: [{
    id: 'ruri-rocks-ch-1',
    seriesId: 'ruri-rocks-series',
    chapterNumber: 1,
    title: 'First Chapter',
    filePath: '/public/ruri_rocks_vol1/ruri_rocks_ch_1.html',
    pageCount: 20,
    addedDate: Date.now() - 86400000,
  }],
  progress: [{
    seriesId: 'ruri-rocks-series',
    chapterId: 'ruri-rocks-ch-1',
    currentPage: 5,
    totalPages: 20,
    percentage: 25,
    lastReadDate: Date.now() - 3600000, // 1 hour ago
    isCompleted: false,
  }],
  bookmarks: [],
  sessions: [],
  lastUpdated: Date.now(),
};

// Store in localStorage using the correct key
localStorage.setItem('mokuro_content', JSON.stringify(sampleData));

console.log('✅ Sample data created with correct key! Refresh the page to see the "Continue Reading" section.');

// Refresh the page to see the changes
window.location.reload();