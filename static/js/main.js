document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    let slides = document.querySelectorAll('.slide');
    const arrowLeft = document.getElementById('arrow-left');
    const arrowRight = document.getElementById('arrow-right');
    const hoverLeft = document.getElementById('hover-left');
    const hoverRight = document.getElementById('hover-right');
    const captionLocation = document.getElementById('caption-location');
    const captionDetails = document.getElementById('caption-details');
    const caption = document.getElementById('caption');
    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');

    if (slides.length === 0) return;

    // Shuffle array helper function
    function shuffleArray(array) {
        const shuffled = Array.from(array);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Shuffle slides on page load for random order every time
    const shuffledSlides = shuffleArray(slides);
    shuffledSlides.forEach((slide, index) => {
        // Update data-index to match new position
        slide.setAttribute('data-index', index);
        // Remove active class from all
        slide.classList.remove('active');
        // Re-append to DOM in shuffled order
        gallery.appendChild(slide);
    });

    // First slide becomes active
    shuffledSlides[0].classList.add('active');

    // Update slides reference after shuffling
    slides = document.querySelectorAll('.slide');

    // Mobile/tablet detection
    function isMobile() {
        return window.innerWidth <= 1024;
    }

    // UI auto-hide for mobile
    let uiHideTimer = null;
    const UI_HIDE_DELAY = 10000; // 10 seconds

    function hideUI() {
        if (!isMobile()) return;
        header.classList.add('ui-hidden');
        footer.classList.add('ui-hidden');
    }

    function showUI() {
        header.classList.remove('ui-hidden');
        footer.classList.remove('ui-hidden');
        resetUIHideTimer();
    }

    function resetUIHideTimer() {
        if (uiHideTimer) clearTimeout(uiHideTimer);
        if (isMobile()) {
            uiHideTimer = setTimeout(hideUI, UI_HIDE_DELAY);
        }
    }

    let currentIndex = 0;
    const loadedImages = new Set(); // Track which slides have had their image src set

    // Preload an image by moving data-src to src
    function preloadImage(index) {
        if (index < 0 || index >= slides.length) return;
        if (loadedImages.has(index)) return;

        const img = slides[index].querySelector('img');
        if (img && img.dataset.src && !img.src) {
            img.src = img.dataset.src;
            loadedImages.add(index);
        }
    }

    // Preload a bounded window of upcoming (and a couple of previous) images.
    // Only ever loading a fixed number of images keeps per-visit bandwidth
    // constant no matter how large the library grows — so this scales to
    // hundreds or thousands of photos. The wide "ahead" margin gives each
    // image many seconds to download before it is shown.
    const PRELOAD_AHEAD = 6;
    const PRELOAD_BEHIND = 2;
    function preloadWindow(index) {
        for (let offset = -PRELOAD_BEHIND; offset <= PRELOAD_AHEAD; offset++) {
            const i = ((index + offset) % slides.length + slides.length) % slides.length;
            preloadImage(i);
        }
    }
    let autoAdvanceTimer = null;
    let captionFadeOutTimer = null;
    let captionFadeInTimer = null;
    const SLIDE_DURATION = 7000; // 7 seconds per slide
    const CAPTION_FADE_IN_DELAY = 2000; // 2 seconds after image appears
    const CAPTION_FADE_OUT_DELAY = 1000; // 1 second before next image

    // Fade out caption
    function fadeOutCaption() {
        caption.classList.add('fading');
    }

    // Fade in caption with new content
    function fadeInCaption() {
        const currentSlide = slides[currentIndex];
        const location = currentSlide.dataset.location || '';
        const details = currentSlide.dataset.details || '';

        captionLocation.textContent = location;
        captionDetails.textContent = details;
        caption.classList.remove('fading');
    }

    // Schedule caption fade out before next slide
    function scheduleCaptionFadeOut() {
        if (captionFadeOutTimer) clearTimeout(captionFadeOutTimer);
        // Fade out 1 second before slide changes
        captionFadeOutTimer = setTimeout(fadeOutCaption, SLIDE_DURATION - CAPTION_FADE_OUT_DELAY);
    }

    // Reveal a slide (called only once its image is ready)
    function activateSlide(index) {
        // Remove active class from all slides
        slides.forEach(slide => slide.classList.remove('active'));

        // Add active class to current slide
        slides[index].classList.add('active');

        currentIndex = index;

        // Fade in caption 2 seconds after image starts appearing
        captionFadeInTimer = setTimeout(fadeInCaption, CAPTION_FADE_IN_DELAY);

        // Schedule fade out for 1 second before next slide
        scheduleCaptionFadeOut();
    }

    // Go to a specific slide
    let navToken = 0;
    function goToSlide(index) {
        // Wrap around
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        // Preload a window of upcoming images
        preloadWindow(index);

        // Clear any pending caption timers
        if (captionFadeInTimer) clearTimeout(captionFadeInTimer);
        if (captionFadeOutTimer) clearTimeout(captionFadeOutTimer);

        // If the incoming image hasn't finished downloading, keep the current
        // one on screen and switch only once it's ready — so a slow load never
        // flashes a blank/broken frame. navToken guards against a stale image
        // loading after the user has already moved on to another slide.
        const token = ++navToken;
        const img = slides[index].querySelector('img');
        if (img && !(img.complete && img.naturalWidth > 0)) {
            const reveal = () => { if (token === navToken) activateSlide(index); };
            img.addEventListener('load', reveal, { once: true });
            img.addEventListener('error', reveal, { once: true });
        } else {
            activateSlide(index);
        }
    }

    // Next slide
    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    // Previous slide
    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    // Start auto-advance timer
    function startAutoAdvance() {
        stopAutoAdvance();
        autoAdvanceTimer = setInterval(nextSlide, SLIDE_DURATION);
    }

    // Stop auto-advance timer
    function stopAutoAdvance() {
        if (autoAdvanceTimer) {
            clearInterval(autoAdvanceTimer);
            autoAdvanceTimer = null;
        }
    }

    // Pause auto-advance on user interaction, resume after delay
    function handleUserInteraction() {
        stopAutoAdvance();
        // Clear and reschedule caption fade out
        if (captionFadeOutTimer) clearTimeout(captionFadeOutTimer);
        scheduleCaptionFadeOut();
        setTimeout(startAutoAdvance, SLIDE_DURATION);
        // Show UI on mobile when user interacts
        showUI();
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            nextSlide();
            handleUserInteraction();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevSlide();
            handleUserInteraction();
        }
    });

    // Click on gallery to advance
    document.addEventListener('click', (e) => {
        // Don't advance if clicking on hover zones or arrows
        if (e.target.closest('.hover-zone') || e.target.closest('.arrow')) return;
        // Don't advance if clicking on header or footer
        if (e.target.closest('.header') || e.target.closest('.footer')) return;

        // Click on left third goes back, rest goes forward
        const clickX = e.clientX;
        const width = window.innerWidth;

        if (clickX < width / 3) {
            prevSlide();
        } else {
            nextSlide();
        }
        handleUserInteraction();
    });

    // Arrow button clicks
    if (arrowLeft) {
        arrowLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            prevSlide();
            handleUserInteraction();
        });
    }

    if (arrowRight) {
        arrowRight.addEventListener('click', (e) => {
            e.stopPropagation();
            nextSlide();
            handleUserInteraction();
        });
    }

    // Hover zone clicks
    if (hoverLeft) {
        hoverLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            prevSlide();
            handleUserInteraction();
        });
    }

    if (hoverRight) {
        hoverRight.addEventListener('click', (e) => {
            e.stopPropagation();
            nextSlide();
            handleUserInteraction();
        });
    }

    // Set initial caption with delayed fade in
    function initializeCaption() {
        // Start with caption hidden
        caption.classList.add('fading');

        // Fade in caption 2 seconds after page load
        captionFadeInTimer = setTimeout(() => {
            const currentSlide = slides[0];
            const location = currentSlide.dataset.location || '';
            const details = currentSlide.dataset.details || '';
            captionLocation.textContent = location;
            captionDetails.textContent = details;
            caption.classList.remove('fading');
        }, CAPTION_FADE_IN_DELAY);

        // Schedule fade out for first slide
        scheduleCaptionFadeOut();
    }

    // Start the slideshow
    startAutoAdvance();

    // Initialize: caption with delayed fade in
    initializeCaption();

    // Preload the opening window of images for smooth early transitions
    preloadWindow(0);

    // Start UI hide timer for mobile
    resetUIHideTimer();
});
