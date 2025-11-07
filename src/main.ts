/**
 * Main Application Entry Point
 * Initializes the beautiful food map application
 */

import 'leaflet/dist/leaflet.css';
import './style.css';
import { MapEngine } from './core/map-engine';
import { StorageLayer } from './app/storage';
import { UIController } from './app/ui';
import { ModalService } from './app/modal-service';
import { AppController } from './app/app-controller';

// Fix Leaflet default icon paths (Vite issue)
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Initialize application
async function initApp() {
  console.log('🗺️ Initializing Food Map...');

  try {
    // 1. Create storage layer
    const storage = new StorageLayer();

    // 2. Create modal service
    const modalService = new ModalService();

    // 3. Create map engine
    const mapEngine = new MapEngine({
      containerId: 'map',
      center: [40.4168, -3.7038], // Madrid center
      zoom: 13,
    });

    // 4. Load data from storage
    const data = await storage.load();
    mapEngine.load(data);

    // 5. Initialize app controller (handles views, theme, navigation)
    const appController = new AppController(mapEngine, storage);

    // 6. Initialize UI controller (handles map interactions, POIs)
    const uiController = new UIController(mapEngine, storage, modalService);
    
    // 7. Link controllers
    uiController.setAppController(appController);

    // 8. Setup import handler
    const importInput = document.getElementById('import-input') as HTMLInputElement;
    if (importInput) {
      importInput.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement)?.files?.[0];
        if (!file) return;

        try {
          const newData = await storage.importFromFile(file);
          mapEngine.load(newData);
          await appController.refreshData();
          
          // Show notification
          const notification = document.createElement('div');
          notification.className = 'notification show';
          notification.textContent = '✅ Data imported successfully!';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
          }, 3000);

          // Reset input
          importInput.value = '';
        } catch (error) {
          console.error('Import failed:', error);
          const notification = document.createElement('div');
          notification.className = 'notification error show';
          notification.textContent = '❌ Failed to import file';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
          }, 3000);
        }
      });
    }

    console.log('✅ Food Map ready!');
    console.log(`📍 Loaded ${data.features.length} POIs`);
    
    // Show welcome message if first time
    if (data.features.length === 0 || !localStorage.getItem('food-map-pois')) {
      console.log('👋 Welcome! This looks like your first time. Check out the demo POIs or add your own!');
    }

  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification error show';
    errorDiv.textContent = '❌ Failed to initialize app. Please refresh the page.';
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '9999';
    document.body.appendChild(errorDiv);
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}