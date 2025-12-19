// About page animations using Motion.dev
import { animate, stagger } from 'motion';

// Animate page elements on load
document.addEventListener('DOMContentLoaded', () => {
    // Animate header
    const header = document.querySelector('.about-header h1');
    if (header) {
        animate(header, 
            { opacity: [0, 1], y: [-20, 0] },
            { duration: 0.6, easing: 'ease-out' }
        );
    }

    // Animate sections with stagger
    const sections = document.querySelectorAll('.about-section');
    animate(sections,
        { opacity: [0, 1], y: [20, 0] },
        { 
            duration: 0.6,
            delay: stagger(0.1),
            easing: 'ease-out'
        }
    );

    // Animate feature cards
    const cards = document.querySelectorAll('.feature-card');
    animate(cards,
        { opacity: [0, 1], scale: [0.95, 1] },
        {
            duration: 0.5,
            delay: stagger(0.05),
            easing: 'ease-out'
        }
    );

});


