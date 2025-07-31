import { Injectable } from '@angular/core';
import { Rive, Layout, Fit, Alignment } from '@rive-app/canvas';
import { Config } from '../shared/config';

export interface MapbanData {
  map_0?: string;
  map_1?: string;
  map_2?: string;
  map_3?: string;
  map_4?: string;
  map_5?: string;
  map_6?: string;
  team1_score?: number;
  team2_score?: number;
  bans?: any[];
}

export interface MapState {
  mapName?: string;
  mapImage?: string;
  teamImage?: string;
  isPastMap: boolean;
  teamScore?: number;
  opponentScore?: number;
  mapNumber?: number;
  isBanned?: boolean;
  isPicked?: boolean;
  bannedBy?: number;
  pickedBy?: number;
  mapScore?: { team1: number; team2: number } | string | null;
}

export interface MapbanFsAssets {
  team1Logo?: string;  // Team 1 logo for past maps
  team2Logo?: string;  // Team 2 logo for past maps
  map_1?: string;      // Map images for maps 1-7
  map_2?: string;
  map_3?: string;
  map_4?: string;
  map_5?: string;
  map_6?: string;
  map_7?: string;
}

export interface SponsorInfo {
  enabled: boolean;
  sponsors: string[];
  duration?: number;
}

export interface TeamInfo {
  tricode: string;
  name: string;
  logo?: string;
}

export interface SideSelection {
  team1Side: 'Attack' | 'Defense';
  team2Side: 'Attack' | 'Defense';
}

@Injectable({
  providedIn: 'root'
})
export class RiveMapbanFsService {
  private canvas: HTMLCanvasElement | null = null;
  private rive: Rive | null = null;
  private currentArtboardName: string = 'BO3';
  private mapStates: MapState[] = [];
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private assetReferences: Map<string, any> = new Map();
  private currentAssetUrls: Map<string, string> = new Map();
  private readonly FRAMES_PER_SECOND = 60;
  private readonly FRAME_DURATION_MS = 1000 / this.FRAMES_PER_SECOND; // 16.67ms per frame

  constructor(private config: Config) {}

  async preloadAsset(url: string): Promise<Uint8Array> {
    try {
      console.log(`Preloading asset: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const processedData = new Uint8Array(arrayBuffer);
      return processedData;
    } catch (error) {
      console.error(`Error preloading asset ${url}:`, error);
      throw error;
    }
  }

  async preloadAssets(assets: MapbanFsAssets): Promise<Map<string, Uint8Array>> {
    const preloadedAssets = new Map<string, Uint8Array>();
    const assetPromises: Promise<void>[] = [];

    for (const [key, url] of Object.entries(assets)) {
      if (url) {
        assetPromises.push(
          this.preloadAsset(url)
            .then((data) => {
              preloadedAssets.set(url, data);
              console.log(`✅ Preloaded asset '${key}': ${url}`);
            })
            .catch((error) => {
              console.error(`❌ Failed to preload asset '${key}' (${url}):`, error);
            })
        );
      }
    }

    await Promise.all(assetPromises);
    this.preloadedAssets = preloadedAssets;
    console.log(`Preloaded ${preloadedAssets.size} assets`);
    return preloadedAssets;
  }

  initializeRive(canvas: HTMLCanvasElement, assets: MapbanFsAssets, preloadedAssets?: Map<string, Uint8Array>): Promise<Rive> {
    return new Promise((resolve, reject) => {
      this.canvas = canvas;
      
      // Set canvas to native resolution to prevent blurriness
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // Create optimized asset loader using preloaded assets
      const assetLoader = (asset: any): boolean => {
        const assetName = asset.name;
        const assetUrl = assets[assetName as keyof MapbanFsAssets];
        
        console.log(`🔍 Asset loader called for: '${assetName}' -> URL: ${assetUrl}`);
        
        // Store the asset reference for later dynamic updates
        this.assetReferences.set(assetName, asset);
        
        if (assetUrl && preloadedAssets?.has(assetUrl)) {
          // Use preloaded asset
          const processedImageData = preloadedAssets.get(assetUrl)!;
          try {
            asset.decode(processedImageData);
            this.currentAssetUrls.set(assetName, assetUrl);
            console.log(`✅ Loaded preloaded asset '${assetName}' from: ${assetUrl}`);
            return true;
          } catch (error) {
            console.error(`Failed to decode preloaded asset ${assetName}:`, error);
            return false;
          }
        } else if (assetUrl) {
          // Fallback to loading if not preloaded
          console.warn(`Asset ${assetName} not preloaded, loading on demand`);
          this.preloadAsset(assetUrl)
            .then((processedImageData: Uint8Array) => {
              asset.decode(processedImageData);
              this.currentAssetUrls.set(assetName, assetUrl);
              console.log(`✅ Loaded on-demand asset '${assetName}' from: ${assetUrl}`);
            })
            .catch((error: any) => {
              console.error(`Failed to load asset ${assetName}:`, error);
            });
          return true;
        }
        
        console.warn(`Asset not found: ${assetName}`);
        return false;
      };

      this.rive = new Rive({
        src: '/assets/mapban/mapban-fs/mapban-fs.riv',
        canvas: canvas,
        layout: new Layout({
          fit: Fit.Cover,
          alignment: Alignment.Center,
        }),
        autoplay: false, // Disable autoplay - we'll start manually after data is loaded
        assetLoader: assetLoader,
        onLoad: () => {
          console.log('✅ Rive mapban-fs loaded successfully');
          
          // Set initial artboard
          this.setArtboard(this.currentArtboardName);
          
          if (this.rive) {
            console.log('🎬 Rive instance created successfully');
            console.log('📊 Rive playback state:', this.rive.isPlaying);
            console.log('⏸️ Animation ready but not started (waiting for data)');
            
            resolve(this.rive);
          } else {
            reject(new Error('Rive instance is null after loading'));
          }
        },
        onLoadError: (error: any) => {
          console.error('❌ Failed to load Rive mapban-fs:', error);
          reject(error);
        }
      });
    });
  }

  setArtboard(artboardName: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For Rive, we typically work with artboards through the Rive instance
      // The artboard switching might be handled through state machine inputs or animations
      this.currentArtboardName = artboardName;
      console.log(`✅ Set current artboard to: ${artboardName}`);
      
      // If there are specific animations or state machine inputs for artboard switching,
      // they would be triggered here
      
      // Re-apply map state animations with the new artboard context
      if (this.mapStates.length > 0) {
        this.applyMapStateAnimations();
      }
    } catch (error) {
      console.error(`Error switching to artboard '${artboardName}':`, error);
    }
  }

  setDataBindingInput(inputName: string, value: any, delayFrames: number = 0): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    const delayMs = delayFrames * this.FRAME_DURATION_MS;

    setTimeout(() => {
      try {
        if (!this.rive) return;

        // Get the 'Default' view model from the Rive instance
        const viewModel = this.rive.viewModelByName('Default');
        if (!viewModel) {
          console.warn("View model 'Default' not found");
          return;
        }

        // Get or create a view model instance and bind it
        let viewModelInstance = this.rive.viewModelInstance;
        if (!viewModelInstance) {
          viewModelInstance = viewModel.defaultInstance();
          this.rive.bindViewModelInstance(viewModelInstance);
        }
        
        if (!viewModelInstance) {
          console.warn('Could not get or create view model instance');
          return;
        }

        // Handle nested image inputs via path (e.g., "MAP 5 SCORE/team")
        if (inputName.includes('/') && typeof value === 'string') {
          const property = viewModelInstance.image(inputName);
          if (property) {
            const assetRef = this.assetReferences.get(value);
            if (assetRef) {
              property.value = assetRef;
              console.log(`✅ Set nested image property '${inputName}' to asset: ${value}`);
            } else {
              console.warn(`Asset reference not found for '${value}'`);
            }
          } else {
            console.warn(`Image property not found at path: '${inputName}'`);
          }
        }
        // Handle top-level boolean inputs (e.g., "pastMap5")
        else if (inputName.startsWith('pastMap') && typeof value === 'boolean') {
          const boolInput = viewModelInstance.boolean(inputName);
          if (boolInput) {
            boolInput.value = value;
            console.log(`✅ Set boolean input '${inputName}' to: ${value}`);
          } else {
            console.warn(`Boolean input '${inputName}' not found`);
          }
        }
        else {
          console.warn(`Unsupported input type or format for '${inputName}': ${typeof value}`);
        }
      } catch (error) {
        console.error(`Error setting data binding input '${inputName}':`, error);
      }
    }, delayMs);
  }

  updateMapStates(mapStates: MapState[], teams?: any[]): void {
    this.mapStates = mapStates;
    this.applyMapStateAnimations();
    
    // Update ban texts using the correct map positions
    this.updateBanTextsFromMapStates(teams);
  }

  private applyMapStateAnimations(): void {
    // Filter for picked maps only (not bans) - these are the ones that get pastMap inputs set
    const pickedMaps = this.mapStates.filter(mapState => mapState.isPicked && mapState.isPastMap);
    
    pickedMaps.forEach((mapState, pickedIndex) => {
      // Determine the correct map number based on the series type and picked index
      let mapNumber: number;
      if (this.currentArtboardName === 'BO3') {
        // BO3: MAP 5, MAP 6, MAP 7
        mapNumber = 5 + pickedIndex;
      } else {
        // BO5: MAP 3, MAP 4, MAP 5, MAP 6, MAP 7
        mapNumber = 3 + pickedIndex;
      }
      
      // Ensure map number is valid (3-7)
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        
        console.log(`🎯 Setting pastMap input for picked map ${pickedIndex + 1}: ${pastMapInputName} = true (${artboardName})`);
        
        // Set the individual pastMap boolean input (no delay - handled in Rive editor)
        this.setDataBindingInput(pastMapInputName, true, 0);
        
        // Set the score text run and winning team image for the nested artboard
        if (mapState.mapScore) {
          let scoreText = '';
          let winningTeam = '';
          
          if (typeof mapState.mapScore === 'string') {
            scoreText = mapState.mapScore;
            // If it's a string, we can't determine the winner, so use team1Logo as default
            winningTeam = 'team1Logo';
          } else if (mapState.mapScore && typeof mapState.mapScore === 'object') {
            const team1Score = mapState.mapScore.team1;
            const team2Score = mapState.mapScore.team2;
            
            // Determine winner and format score with winning score first
            if (team1Score > team2Score) {
              scoreText = `${team1Score} - ${team2Score}`;
              winningTeam = 'team1Logo';
            } else if (team2Score > team1Score) {
              scoreText = `${team2Score} - ${team1Score}`;
              winningTeam = 'team2Logo';
            } else {
              // Tie case - keep original order
              scoreText = `${team1Score} - ${team2Score}`;
              winningTeam = 'team1Logo'; // Default to team1 for ties
            }
          }
          
          if (scoreText) {
            // Set the score text run on the nested artboard
            this.setNestedTextRun('Score', scoreText, artboardName);
            
            // Set the "team" input to control which team logo to show on the nested artboard
            const teamInputPath = `${artboardName}/team`;
            this.setDataBindingInput(teamInputPath, winningTeam, 0);
            
            console.log(`✅ Set score "${scoreText}" and team selector to "${winningTeam}" for ${artboardName}`);
          }
        }
      } else {
        console.warn(`Invalid map number ${mapNumber} for series ${this.currentArtboardName}`);
      }
    });
  }

  setTextRun(textRunName: string, value: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For text runs, use the high-level API
      this.rive.setTextRunValue(textRunName, value.toUpperCase());
      console.log(`✅ Set text run '${textRunName}' to: ${value.toUpperCase()}`);
    } catch (error) {
      console.error(`Error setting text run '${textRunName}':`, error);
    }
  }

  setNestedTextRun(textRunName: string, value: string, path: string): void {
    if (!this.rive) {
      console.error('Rive not initialized');
      return;
    }

    try {
      // For nested text runs, use the path-based API
      this.rive.setTextRunValueAtPath(textRunName, value.toUpperCase(), path);
      console.log(`✅ Set nested text run '${textRunName}' at path '${path}' to: ${value.toUpperCase()}`);
    } catch (error) {
      console.error(`Error setting nested text run '${textRunName}' at path '${path}':`, error);
    }
  }

  updateMapTexts(mapStates: MapState[]): void {
    mapStates.forEach((mapState, index) => {
      const mapName = mapState.mapName || 'UNKNOWN MAP';
      
      // For picked maps that are on nested artboards, use nested text run updates
      if (mapState.isPicked && mapState.isPastMap) {
        // Find the picked map index among all picked maps
        const pickedMaps = mapStates.filter(ms => ms.isPicked && ms.isPastMap);
        const pickedIndex = pickedMaps.findIndex(ms => ms === mapState);
        
        if (pickedIndex >= 0) {
          // Determine the correct map number for picks based on series type
          let mapNumber: number;
          if (this.currentArtboardName === 'BO3') {
            // BO3: picked maps are 5, 6, 7
            mapNumber = 5 + pickedIndex;
          } else {
            // BO5: picked maps are 3, 4, 5, 6, 7
            mapNumber = 3 + pickedIndex;
          }
          
          const artboardName = `MAP ${mapNumber} SCORE`;
          
          // Update the map name text run on the nested artboard
          this.setNestedTextRun('MapName', mapName, artboardName);
          
          // Update other pick-related text runs using the correct map number
          this.updatePickTextRuns(mapState, mapNumber);
        }
      } else if (mapState.isBanned) {
        // For banned maps, use standard ban text approach (handled in updateBanTexts)
        // No individual map text runs needed for bans as they use ban1, ban2, etc.
        console.log(`📝 Ban map ${index + 1}: ${mapName} (handled via updateBanTexts)`);
      } else {
        // For other maps (if any), use standard approach
        const textRunName = `map${index + 1}`;
        this.setTextRun(textRunName, mapName);
      }
    });
  }

  private updatePickTextRuns(mapState: MapState, mapNumber: number): void {
    if (!mapState.mapName) return;
    
    const mapName = mapState.mapName.toUpperCase();
    
    // Update pick-related text runs with correct map number
    // These text runs should exist for maps 5-7 in BO3 and maps 3-7 in BO5
    try {
      // Set the map pick text run: "MAP [NUMBER] PICK"
      this.setTextRun(`MAP ${mapNumber} PICK`, mapName);
      
      // Set the team that picked the map: "MAP [NUMBER] PICK TEAM"
      if (mapState.pickedBy !== undefined) {
        const teamName = mapState.pickedBy === 0 ? 'TEAM 1' : 'TEAM 2'; // This should be updated with actual team names
        this.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamName);
      }
      
      // Set the defending team: "MAP [NUMBER] DEF TEAM"
      // This would typically be determined by side selection logic
      if (mapState.teamImage) {
        this.setTextRun(`MAP ${mapNumber} DEF TEAM`, 'DEF TEAM'); // Placeholder
      }
      
      // Set the map side: "MAP [NUMBER] SIDE"
      // This would be Attack/Defense based on side selection
      this.setTextRun(`MAP ${mapNumber} SIDE`, 'ATTACK'); // Placeholder
      
      console.log(`✅ Updated pick text runs for MAP ${mapNumber}: ${mapName}`);
    } catch (error) {
      console.error(`Error updating pick text runs for MAP ${mapNumber}:`, error);
    }
  }

  updateBanTexts(bans: any[]): void {
    // This method should actually receive the full mapStates array, not just banned maps
    // For now, we'll process what we get but the real fix should be in the component
    console.log('⚠️ updateBanTexts: This method needs mapStates, not just banned maps');
  }

  // New method to handle ban texts correctly using mapStates
  updateBanTextsFromMapStates(teams?: any[]): void {
    if (this.currentArtboardName === 'BO3') {
      // BO3: Maps 1, 2, 3, 4 are banned maps (positions 5, 6, 7 are picked maps)
      const banPositions = [1, 2, 3, 4];
      let banCounter = 1;
      
      banPositions.forEach(mapPosition => {
        const mapState = this.mapStates[mapPosition - 1]; // Convert to 0-based index
        if (mapState && mapState.mapName) {
          // Get team tricode from teams array if provided
          let teamTricode = 'TEAM';
          if (mapState.bannedBy !== undefined) {
            if (teams && teams[mapState.bannedBy]) {
              teamTricode = teams[mapState.bannedBy].tricode || teams[mapState.bannedBy].name || 'TEAM';
            } else {
              teamTricode = mapState.bannedBy === 0 ? 'TEAM 1' : 'TEAM 2';
            }
          } else {
            // Fallback if bannedBy is not set - alternate teams
            teamTricode = banCounter % 2 === 1 ? (teams?.[0]?.tricode || 'TEAM 1') : (teams?.[1]?.tricode || 'TEAM 2');
          }
          
          const banText = `${teamTricode.toUpperCase()} BAN ${mapState.mapName.toUpperCase()}`;
          this.setTextRun(`BAN ${banCounter} TEXT`, banText);
          console.log(`✅ Set BAN ${banCounter} TEXT (Map ${mapPosition}): ${banText}`);
        } else {
          console.warn(`Map at position ${mapPosition} has no mapName or mapState`);
        }
        banCounter++;
      });
      
    } else {
      // BO5: Maps 1, 2 are banned maps
      const banPositions = [1, 2];
      let banCounter = 1;
      
      banPositions.forEach(mapPosition => {
        const mapState = this.mapStates[mapPosition - 1]; // Convert to 0-based index
        if (mapState && mapState.mapName) {
          // Get team tricode from teams array if provided
          let teamTricode = 'TEAM';
          if (mapState.bannedBy !== undefined) {
            if (teams && teams[mapState.bannedBy]) {
              teamTricode = teams[mapState.bannedBy].tricode || teams[mapState.bannedBy].name || 'TEAM';
            } else {
              teamTricode = mapState.bannedBy === 0 ? 'TEAM 1' : 'TEAM 2';
            }
          } else {
            // Fallback if bannedBy is not set - alternate teams
            teamTricode = banCounter % 2 === 1 ? (teams?.[0]?.tricode || 'TEAM 1') : (teams?.[1]?.tricode || 'TEAM 2');
          }
          
          const banText = `${teamTricode.toUpperCase()} BAN ${mapState.mapName.toUpperCase()}`;
          this.setTextRun(`BAN ${banCounter} TEXT`, banText);
          console.log(`✅ Set BAN ${banCounter} TEXT (Map ${mapPosition}): ${banText}`);
        } else {
          console.warn(`Map at position ${mapPosition} has no mapName or mapState`);
        }
        banCounter++;
      });
    }
  }

  getCurrentArtboard(): string {
    return this.currentArtboardName;
  }

  getMapStates(): MapState[] {
    return [...this.mapStates];
  }

  reset(): void {
    this.mapStates = [];
    this.preloadedAssets.clear();
    this.assetReferences.clear();
    this.currentAssetUrls.clear();
    
    // Reset all pastMap inputs before cleanup
    if (this.rive) {
      this.resetAllPastMapInputs();
    }
    
    if (this.rive) {
      this.rive.cleanup();
      this.rive = null;
    }
    
    this.canvas = null;
    
    console.log('✅ Rive mapban-fs service reset');
  }

  cleanup(): void {
    this.reset();
  }

  getRive(): Rive | null {
    return this.rive;
  }

  async preloadAndProcessAsset(url: string): Promise<Uint8Array> {
    return this.preloadAsset(url);
  }

  updateSponsorInfo(sponsorInfo: SponsorInfo): void {
    console.log('📢 Updating sponsor info:', sponsorInfo);
    // Placeholder implementation
  }

  updateAssetsFromPreloaded(assets: MapbanFsAssets, preloadedAssets: Map<string, Uint8Array>): void {
    console.log('🔄 Updating assets from preloaded cache');
    // Placeholder implementation
  }

  setTeamInfo(teamIndex: number, teamInfo: TeamInfo): void {
    console.log(`🏆 Setting team ${teamIndex} info:`, teamInfo);
    // Placeholder implementation
  }

  setPastMapScore(mapNumber: number, mapScore: { team1: number; team2: number } | string | null, show: boolean): void {
    console.log(`📊 Setting past map ${mapNumber} score:`, mapScore, 'show:', show);
    
    if (!show || !mapScore) {
      return;
    }
    
    // Convert score to string format with winning score first
    let scoreText = '';
    let winningTeam = '';
    
    if (typeof mapScore === 'string') {
      scoreText = mapScore;
      winningTeam = 'team1Logo'; // Default for string scores
    } else if (mapScore && typeof mapScore === 'object') {
      const team1Score = mapScore.team1;
      const team2Score = mapScore.team2;
      
      // Determine winner and format score with winning score first
      if (team1Score > team2Score) {
        scoreText = `${team1Score} - ${team2Score}`;
        winningTeam = 'team1Logo';
      } else if (team2Score > team1Score) {
        scoreText = `${team2Score} - ${team1Score}`;
        winningTeam = 'team2Logo';
      } else {
        // Tie case - keep original order
        scoreText = `${team1Score} - ${team2Score}`;
        winningTeam = 'team1Logo'; // Default to team1 for ties
      }
    }
    
    if (scoreText) {
      // Validate map number range (3-7)
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        
        // Set the pastMap input for this specific map
        this.setDataBindingInput(pastMapInputName, true, 0);
        
        // Set the score text run on the nested artboard
        this.setNestedTextRun('Score', scoreText, artboardName);
        
        // Set the "team" input to control which team logo to show
        const teamInputPath = `${artboardName}/team`;
        this.setDataBindingInput(teamInputPath, winningTeam, 0);
        
        console.log(`✅ Set ${pastMapInputName} = true, score = "${scoreText}", and team selector = "${winningTeam}" for ${artboardName}`);
      } else {
        console.warn(`Map number ${mapNumber} not valid (must be 3-7)`);
      }
    }
  }

  resetAllPastMapInputs(): void {
    console.log('🔄 Resetting all pastMap inputs to false');
    
    // Reset all possible pastMap inputs (3-7)
    for (let mapNumber = 3; mapNumber <= 7; mapNumber++) {
      const pastMapInputName = `pastMap${mapNumber}`;
      this.setDataBindingInput(pastMapInputName, false, 0);
    }
  }

  // Helper method to build asset paths
  buildAssetPath(assetType: string, filename: string): string {
    // Use a default assets path since config doesn't have assetsUrl
    return `/assets/${assetType}/${filename}`;
  }

  // Animation control methods
  pauseAnimation(): void {
    if (this.rive && this.rive.isPlaying) {
      this.rive.pause();
      console.log('⏸️ Paused Rive animation');
    }
  }

  playAnimation(): void {
    if (this.rive && !this.rive.isPlaying) {
      this.rive.play();
      console.log('▶️ Started Rive animation');
    }
  }

  startAnimationWithData(): void {
    if (this.rive) {
      this.rive.play();
      console.log('🎬 Started Rive animation with data loaded');
    }
  }

  isAnimationPlaying(): boolean {
    return this.rive ? this.rive.isPlaying : false;
  }

  // Debug method to log all available elements
  debugArtboard(): void {
    if (!this.rive) {
      console.log('No Rive instance available for debugging');
      return;
    }

    console.log('=== Rive Mapban-FS Debug Information ===');
    console.log('Current Artboard:', this.currentArtboardName);
    console.log('Preloaded Assets:', Array.from(this.preloadedAssets.keys()));
    console.log('Asset References:', Array.from(this.assetReferences.keys()));
    console.log('Current Asset URLs:', Array.from(this.currentAssetUrls.entries()));
    console.log('Map States:', this.mapStates);
    
    // Show picked maps and their expected pastMap input names
    const pickedMaps = this.mapStates.filter(ms => ms.isPicked && ms.isPastMap);
    console.log('Picked Maps with PastMap Inputs:');
    pickedMaps.forEach((mapState, pickedIndex) => {
      let mapNumber: number;
      if (this.currentArtboardName === 'BO3') {
        mapNumber = 5 + pickedIndex;
      } else {
        mapNumber = 3 + pickedIndex;
      }
      
      if (mapNumber >= 3 && mapNumber <= 7) {
        const artboardName = `MAP ${mapNumber} SCORE`;
        const pastMapInputName = `pastMap${mapNumber}`;
        console.log(`  - Picked Map ${pickedIndex + 1}: ${pastMapInputName} → ${artboardName}`);
      }
    });
    
    console.log('==========================================');
  }
}
