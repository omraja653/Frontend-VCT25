import { Component, inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { SocketService } from "../services/SocketService";
import { Config } from "../shared/config";
import { RiveMapbanService, MapbanAssets, SponsorInfo, MapState, TeamInfo, SideSelection } from "../services/rive-mapban.service";
import { CommonModule } from "@angular/common";

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: "app-mapban-ui",
  template: `
    <div class="mapban-container">
      <canvas #riveCanvas class="mapban-canvas"></canvas>
    </div>
  `,
  styles: [`
    .mapban-container {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }
    
    .mapban-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `]
})
export class MapbanUiComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('riveCanvas', { static: true }) riveCanvas!: ElementRef<HTMLCanvasElement>;
  
  private route = inject(ActivatedRoute);
  private config = inject(Config);
  @Input() data!: ISessionData;

  sessionCode = "UNKNOWN";
  socketService!: SocketService;

  // Rive mapban service
  private riveService = inject(RiveMapbanService);
  
  // Asset preloading
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private isPreloadingComplete = false;
  
  // Match data for assets
  private match: any = null;

  constructor() {
    const params = this.route.snapshot.queryParams;
    this.sessionCode = params["sessionId"] || "UNKNOWN";
  }

  ngOnInit(): void {
    this.socketService = SocketService.getInstance();
    this.socketService.subscribeMapban((data: any) => {
      this.updateMapbanData(data);
    });
    this.socketService.connectMapban(this.config.mapbanEndpoint, {
      sessionId: this.sessionCode,
    });
  }

  ngAfterViewInit(): void {
    this.socketService.subscribeMatch((data: any) => {
      // Store match data for asset loading
      this.match = data;
      this.updateMapbanData(data);
    });
    
    // Initialize Rive animation after view is ready
    this.initializeRiveAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && changes["data"].currentValue) {
      this.updateMapbanData({ data: changes["data"].currentValue });
    }
  }

  ngOnDestroy(): void {
    this.riveService.cleanup();
  }

  private async initializeRiveAnimation(): Promise<void> {
    try {
      // Preload all assets first for performance
      await this.preloadAllAssets();
      
      // Set up initial mapban assets
      const assets = this.buildMapbanAssets();
      
      // Initialize Rive with preloaded assets
      await this.riveService.initializeRive(
        this.riveCanvas.nativeElement,
        assets,
        this.preloadedAssets
      );
      
      console.log('🎬 Rive mapban animation initialized');
    } catch (error) {
      console.error('Failed to initialize Rive mapban animation:', error);
    }
  }

  private async preloadAllAssets(): Promise<void> {
    if (this.isPreloadingComplete) return;
    
    console.log('🔄 Starting asset preloading for mapban...');
    
    const assetsToPreload: string[] = [];
    
    // Add default assets
    assetsToPreload.push('/assets/misc/logo.webp'); // Default sponsor/event logo
    
    // Add team logos if available from match data
    if (this.match?.teams) {
      for (let i = 0; i < this.match.teams.length; i++) {
        const teamUrl = this.getProxiedImageUrl(this.match.teams[i]?.teamUrl);
        if (teamUrl && teamUrl !== '/assets/misc/icon.webp') {
          assetsToPreload.push(teamUrl);
        }
      }
    }
    
    // Add tournament logo if available
    const tournamentLogoUrl = this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl);
    if (tournamentLogoUrl && tournamentLogoUrl !== '/assets/misc/icon.webp') {
      assetsToPreload.push(tournamentLogoUrl);
    }
    
    // Add map images
    const mapAssets = [
      '/assets/maps/wide/Ascent.webp',
      '/assets/maps/wide/Bind.webp',
      '/assets/maps/wide/Haven.webp',
      '/assets/maps/wide/Split.webp',
      '/assets/maps/wide/Lotus.webp',
      '/assets/maps/wide/Sunset.webp',
      '/assets/maps/wide/Icebox.webp'
    ];
    assetsToPreload.push(...mapAssets);
    
    // Preload all assets in parallel
    const preloadPromises = assetsToPreload.map(async (url) => {
      try {
        const processedData = await this.riveService.preloadAndProcessAsset(url);
        this.preloadedAssets.set(url, processedData);
        console.log(`✅ Preloaded: ${url}`);
      } catch (error) {
        console.warn(`⚠️ Failed to preload: ${url}`, error);
      }
    });
    
    await Promise.all(preloadPromises);
    this.isPreloadingComplete = true;
    console.log('🎯 Asset preloading complete');
  }

  private buildMapbanAssets(): MapbanAssets {
    const assets: MapbanAssets = {
      // Event/tournament logo
      eventLogo: this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl) || '/assets/misc/icon.webp',
      
      // Team logos
      t1_logo: this.getProxiedImageUrl(this.match?.teams?.[0]?.teamUrl) || '/assets/misc/icon.webp',
      t2_logo: this.getProxiedImageUrl(this.match?.teams?.[1]?.teamUrl) || '/assets/misc/icon.webp',
      
      // Sponsor (can use tournament logo or default)
      sponsor: this.getProxiedImageUrl(this.match?.tools?.tournamentInfo?.logoUrl) || '/assets/misc/icon.webp',
      
      // Map assets (these will be set dynamically based on available maps)
      map_1: '/assets/maps/wide/Ascent.webp',
      map_2: '/assets/maps/wide/Bind.webp',
      map_3: '/assets/maps/wide/Haven.webp',
      map_4: '/assets/maps/wide/Split.webp',
      map_5: '/assets/maps/wide/Lotus.webp',
      map_6: '/assets/maps/wide/Sunset.webp',
      map_7: '/assets/maps/wide/Icebox.webp'
    };
    
    return assets;
  }

  private getProxiedImageUrl(url?: string): string | undefined {
    if (!url || url === '') return undefined;
    
    // If it's already a local asset or proxy URL, return as-is
    if (url.startsWith('/assets/') || url.startsWith('/proxy-image')) {
      return url;
    }
    
    // If it's an external URL, proxy it
    if (/^https?:\/\//.test(url)) {
      return `/proxy-image?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  }

  public updateMapbanData(data: { data: ISessionData }): void {
    this.data = data.data;
    console.log('Mapban data updated:', this.data);
    
    // Update Rive animation based on the data
    this.updateRiveAnimation();
  }

  private updateRiveAnimation(): void {
    if (!this.data || !this.riveService.getRive()) return;
    
    // Set team information
    if (this.data.teams) {
      for (let i = 0; i < this.data.teams.length; i++) {
        const teamInfo: TeamInfo = {
          tricode: this.data.teams[i].tricode || 'TEAM',
          name: this.data.teams[i].name || 'Team Name'
        };
        this.riveService.setTeamInfo(i, teamInfo);
      }
    }
    
    // Process map states from selected maps
    if (this.data.selectedMaps) {
      const mapStates: MapState[] = [];
      
      this.data.selectedMaps.forEach((sessionMap, index) => {
        const mapNumber = index + 1;
        const mapState: MapState = {
          mapNumber,
          isBanned: sessionMap.bannedBy !== undefined,
          isPicked: sessionMap.pickedBy !== undefined,
          bannedBy: sessionMap.bannedBy,
          pickedBy: sessionMap.pickedBy
        };
        
        mapStates.push(mapState);
        
        // Update map name text
        if (sessionMap.name && sessionMap.name !== '' && sessionMap.name !== 'upcoming') {
          this.riveService.updateMapNameText(mapNumber, sessionMap.name);
        }
        
        // Handle side selection for picks
        if (sessionMap.pickedBy !== undefined && sessionMap.sidePickedBy !== undefined) {
          const sideSelection: SideSelection = {
            team: sessionMap.pickedBy,
            side: sessionMap.pickedAttack === true ? 'ATTACK' : 'DEFENSE'
          };
          
          this.riveService.updateMapStatus(
            mapNumber,
            false,
            true,
            sessionMap.pickedBy,
            sessionMap.name,
            sideSelection
          );
        } else if (sessionMap.bannedBy !== undefined) {
          this.riveService.updateMapStatus(
            mapNumber,
            true,
            false,
            sessionMap.bannedBy,
            sessionMap.name
          );
        } else if (sessionMap.pickedBy !== undefined) {
          this.riveService.updateMapStatus(
            mapNumber,
            false,
            true,
            sessionMap.pickedBy,
            sessionMap.name
          );
        }
      });
      
      // Check if there's a decider map (last map that's neither banned nor picked)
      const availableMapCount = this.data.availableMaps?.length || 7;
      const bannedCount = mapStates.filter(m => m.isBanned).length;
      const pickedCount = mapStates.filter(m => m.isPicked).length;
      
      if (bannedCount + pickedCount === availableMapCount - 1) {
        // Find the remaining map and set it as decider
        const deciderMapIndex = mapStates.findIndex(m => !m.isBanned && !m.isPicked);
        if (deciderMapIndex !== -1) {
          const deciderMapName = this.data.selectedMaps[deciderMapIndex]?.name;
          this.riveService.setDeciderMap(deciderMapIndex + 1, deciderMapName);
        }
      }
    }
    
    // Update sponsor information if available
    if (this.match?.tools?.sponsorInfo) {
      this.riveService.updateSponsorInfo(this.match.tools.sponsorInfo);
    }
    
    // Update assets if they've changed
    const newAssets = this.buildMapbanAssets();
    this.riveService.updateAssetsFromPreloaded(newAssets, this.preloadedAssets);
  }
}

export interface ISessionData {
  sessionIdentifier: string;
  organizationName: string;
  teams: ISessionTeam[];
  format: "bo1" | "bo3" | "bo5" | undefined;
  availableMaps: SessionMap[];
  selectedMaps: SessionMap[];
  stage: Stage;
  actingTeamCode: string;
  actingTeam: 0 | 1;
}

export interface ISessionTeam {
  name: string;
  tricode: string;
  url: string;
}

export class SessionMap {
  name: string;
  bannedBy?: 0 | 1 = undefined; // 0 = left team, 1 = right team
  pickedBy?: 0 | 1 = undefined;
  sidePickedBy?: 0 | 1 = undefined;
  pickedAttack: boolean | undefined = undefined;

  constructor(name: string) {
    this.name = name;
  }
}

export type Stage = "ban" | "pick" | "side" | "decider";
