"use client"

import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"

import { cellToLatLng, cellsToMultiPolygon, getResolution } from "h3-js"
import { useTheme } from "next-themes"
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegment,
  useSelectedLayoutSegments,
} from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Map, {
  Layer,
  MapLayerMouseEvent,
  MapRef,
  MapStyle,
  NavigationControl,
  Source,
} from "react-map-gl"
import { gaEvent } from "../GATracker"
import { NetworkCoverageLayer } from "./NetworkCoverageLayer"
import { mapLayersDark } from "./mapLayersDark"
import { mapLayersLight } from "./mapLayersLight"
import {
  HexFeatureDetails,
  INITIAL_MAP_VIEW_STATE,
  MAP_CONTAINER_STYLE,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  ZOOM_BY_HEX_RESOLUTION,
  getHexOutlineStyle,
  networkLayers,
} from "./utils"
import { mockDroneRadars } from "./mockdata"

// // Mock data for drone concentration radars
// const mockDroneRadars = [
//   {
//     id: "drone-1",
//     lat: 37.7749, // Latitude
//     lng: -122.4194, // Longitude
//     status: "active", // "active" or "inactive"
//     concentration: 0.8, // Concentration level (0 to 1)
//   },
//   {
//     id: "drone-2",
//     lat: 34.0522,
//     lng: -118.2437,
//     status: "inactive",
//     concentration: 0.3,
//   },
//   {
//     id: "drone-3",
//     lat: 36.1699,
//     lng: -115.1398,
//     status: "active",
//     concentration: 0.9,
//   },
// ];

// Convert mock data to GeoJSON format
const droneRadarsGeoJSON = {
  type: "FeatureCollection",
  features:
    mockDroneRadars &&
    mockDroneRadars.map((radar) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [radar.lng, radar.lat],
      },
      properties: {
        id: radar.id,
        status: radar.status,
        concentration: radar.concentration,
      },
    })),
}

// Define a layer style for drone radars
const droneRadarLayer: Layer = {
  id: "drone_radars",
  type: "circle",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "concentration"],
      0,
      5, // Minimum radius
      1,
      20, // Maximum radius
    ],
    "circle-color": [
      "match",
      ["get", "status"],
      "active",
      "#00ff00", // Green for active
      "inactive",
      "#ff0000", // Red for inactive
      "#cccccc", // Default color
    ],
    "circle-opacity": 0.8,
  },
}

export function HotspotsMap({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSelectedLayoutSegments()
  const segment = useSelectedLayoutSegment()
  const mapRef = useRef<MapRef>(null)
  const [selectedHex, setSelectedHex] = useState<HexFeatureDetails | null>(null)
  const [cursor, setCursor] = useState("")

  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol("pmtiles", protocol.tile)
    return () => {
      maplibregl.removeProtocol("pmtiles")
    }
  }, [])

  const mapStyle = useMemo(() => {
    const style: MapStyle = {
      version: 8,
      sources: {
        protomaps: {
          type: "vector",
          tiles: [`${process.env.NEXT_PUBLIC_PMTILES_URL}/{z}/{x}/{y}.mvt`],
        },
      },
      glyphs: "https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf",
      layers: resolvedTheme === "dark" ? mapLayersDark : mapLayersLight,
    }
    return style
  }, [resolvedTheme])

  const selectHex = useCallback((hexId: string | null) => {
    if (!hexId) {
      setSelectedHex(null)
      return
    }

    const selectedHex = {
      hexId,
      geojson: {
        type: "MultiPolygon",
        coordinates: cellsToMultiPolygon([hexId], true),
      } as GeoJSON.Geometry,
    }

    setSelectedHex(selectedHex)

    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const [lat, lng] = cellToLatLng(hexId)
    const bounds = map.getBounds()
    const zoom = map.getZoom()
    const hexResolution = getResolution(hexId)
    const newZoom = ZOOM_BY_HEX_RESOLUTION[hexResolution]
    if (zoom < newZoom - 3 || !bounds.contains([lng, lat])) {
      // Fly to the hex if it's not visible in the current viewport, or if it's not zoomed in enough
      map.flyTo({ center: [lng, lat], zoom: newZoom })
    }
  }, [])

  const selectHexByPathname = useCallback(() => {
    if (!mapRef.current) return

    if (segments.length === 2 && segments[0] === "hex") {
      const hexId = segments[1]
      if (selectedHex?.hexId !== hexId) {
        selectHex(hexId)
      }
    } else if (pathname === "/" && selectedHex?.hexId) {
      selectHex(null)
    }
  }, [pathname, segments, selectHex, selectedHex?.hexId])

  useEffect(() => {
    selectHexByPathname()
  }, [selectHexByPathname])

  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      event.features?.forEach(({ layer, properties }) => {
        if (layer.id !== "hexes_layer" || !properties?.id) return
        if (selectedHex?.hexId === properties.id) {
          router.push("/")
        } else {
          router.push(`/hex/${properties.id}`)
        }
      })
    },
    [router, selectedHex?.hexId]
  )

  const onDroneRadarClick = useCallback((event: MapLayerMouseEvent) => {
    event.features?.forEach((feature) => {
      if (feature.layer.id === "drone_radars") {
        const { id, status, concentration } = feature.properties
        console.log(
          `Drone Radar ID: ${id}, Status: ${status}, Concentration: ${concentration}`
        )
        // Optionally, navigate to a details page or show a tooltip
      }
    })
  }, [])

  useEffect(() => {
    gaEvent({ action: "map_load" })
  }, [])

  const onMouseEnter = useCallback(() => setCursor("pointer"), [])
  const onMouseLeave = useCallback(() => setCursor(""), [])

  return (
    <Map
      initialViewState={INITIAL_MAP_VIEW_STATE}
      minZoom={MIN_MAP_ZOOM}
      maxZoom={MAX_MAP_ZOOM}
      style={MAP_CONTAINER_STYLE}
      mapStyle={mapStyle}
      localFontFamily="NotoSans-Regular"
      // @ts-ignore
      mapLib={maplibregl}
      interactiveLayerIds={["hexes_layer", "drone_radars"]}
      onLoad={selectHexByPathname}
      onClick={onDroneRadarClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor={cursor}
      ref={mapRef}
      attributionControl={false}
    >
      <NavigationControl position="bottom-left" showCompass={false} />
      {children}

      {/* Existing layers */}
      {segment !== "mobile" && (
        <NetworkCoverageLayer layer={networkLayers.iot} />
      )}

      {/* Add the drone radar layer */}
      <Source type="geojson" data={droneRadarsGeoJSON}>
        <Layer {...droneRadarLayer} />
      </Source>

      {/* Existing selected hex layer */}
      {selectedHex && (
        <Source type="geojson" data={selectedHex.geojson}>
          <Layer type="line" paint={getHexOutlineStyle(resolvedTheme)} />
        </Source>
      )}
    </Map>
  )
}

// "use client"

// import maplibregl from "maplibre-gl"
// import "maplibre-gl/dist/maplibre-gl.css"
// import { Protocol } from "pmtiles"

// import { cellToLatLng, cellsToMultiPolygon, getResolution } from "h3-js"
// import { useTheme } from "next-themes"
// import {
//   usePathname,
//   useRouter,
//   useSelectedLayoutSegment,
//   useSelectedLayoutSegments,
// } from "next/navigation"
// import { useCallback, useEffect, useMemo, useRef, useState } from "react"
// import Map, {
//   Layer,
//   MapLayerMouseEvent,
//   MapRef,
//   MapStyle,
//   NavigationControl,
//   Source,
// } from "react-map-gl"
// import { gaEvent } from "../GATracker"
// import { NetworkCoverageLayer } from "./NetworkCoverageLayer"
// import { mapLayersDark } from "./mapLayersDark"
// import { mapLayersLight } from "./mapLayersLight"
// import {
//   HexFeatureDetails,
//   INITIAL_MAP_VIEW_STATE,
//   MAP_CONTAINER_STYLE,
//   MAX_MAP_ZOOM,
//   MIN_MAP_ZOOM,
//   ZOOM_BY_HEX_RESOLUTION,
//   getHexOutlineStyle,
//   networkLayers,
// } from "./utils"

// export function HotspotsMap({ children }: { children: React.ReactNode }) {
//   const { resolvedTheme } = useTheme()
//   const router = useRouter()
//   const pathname = usePathname()
//   const segments = useSelectedLayoutSegments()
//   const segment = useSelectedLayoutSegment()
//   const mapRef = useRef<MapRef>(null)
//   const [selectedHex, setSelectedHex] = useState<HexFeatureDetails | null>(null)
//   const [cursor, setCursor] = useState("")

//   useEffect(() => {
//     let protocol = new Protocol()
//     maplibregl.addProtocol("pmtiles", protocol.tile)
//     return () => {
//       maplibregl.removeProtocol("pmtiles")
//     }
//   }, [])

//   const mapStyle = useMemo(() => {
//     const style: MapStyle = {
//       version: 8,
//       sources: {
//         protomaps: {
//           type: "vector",
//           tiles: [`${process.env.NEXT_PUBLIC_PMTILES_URL}/{z}/{x}/{y}.mvt`],
//         },
//       },
//       glyphs: "https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf",
//       layers: resolvedTheme === "dark" ? mapLayersDark : mapLayersLight,
//     }
//     return style
//   }, [resolvedTheme])

//   const selectHex = useCallback((hexId: string | null) => {
//     if (!hexId) {
//       setSelectedHex(null)
//       return
//     }

//     const selectedHex = {
//       hexId,
//       geojson: {
//         type: "MultiPolygon",
//         coordinates: cellsToMultiPolygon([hexId], true),
//       } as GeoJSON.Geometry,
//     }

//     setSelectedHex(selectedHex)

//     if (!mapRef.current) return
//     const map = mapRef.current.getMap()
//     const [lat, lng] = cellToLatLng(hexId)
//     const bounds = map.getBounds()
//     const zoom = map.getZoom()
//     const hexResolution = getResolution(hexId)
//     const newZoom = ZOOM_BY_HEX_RESOLUTION[hexResolution]
//     if (zoom < newZoom - 3 || !bounds.contains([lng, lat])) {
//       // Fly to the hex if it's not visible in the current viewport, or if it's not zoomed in enough
//       map.flyTo({ center: [lng, lat], zoom: newZoom })
//     }
//   }, [])

//   const selectHexByPathname = useCallback(() => {
//     if (!mapRef.current) return

//     if (segments.length === 2 && segments[0] === "hex") {
//       const hexId = segments[1]
//       if (selectedHex?.hexId !== hexId) {
//         selectHex(hexId)
//       }
//     } else if (pathname === "/" && selectedHex?.hexId) {
//       selectHex(null)
//     }
//   }, [pathname, segments, selectHex, selectedHex?.hexId])

//   useEffect(() => {
//     selectHexByPathname()
//   }, [selectHexByPathname])

//   const onClick = useCallback(
//     (event: MapLayerMouseEvent) => {
//       event.features?.forEach(({ layer, properties }) => {
//         if (layer.id !== "hexes_layer" || !properties?.id) return
//         if (selectedHex?.hexId === properties.id) {
//           router.push("/")
//         } else {
//           router.push(`/hex/${properties.id}`)
//         }
//       })
//     },
//     [router, selectedHex?.hexId]
//   )

//   useEffect(() => {
//     gaEvent({ action: "map_load" })
//   }, [])

//   const onMouseEnter = useCallback(() => setCursor("pointer"), [])
//   const onMouseLeave = useCallback(() => setCursor(""), [])

//   return (
//     <Map
//       initialViewState={INITIAL_MAP_VIEW_STATE}
//       minZoom={MIN_MAP_ZOOM}
//       maxZoom={MAX_MAP_ZOOM}
//       style={MAP_CONTAINER_STYLE}
//       mapStyle={mapStyle}
//       localFontFamily="NotoSans-Regular"
//       // @ts-ignore
//       mapLib={maplibregl}
//       interactiveLayerIds={["hexes_layer"]}
//       onLoad={selectHexByPathname}
//       onClick={onClick}
//       onMouseEnter={onMouseEnter}
//       onMouseLeave={onMouseLeave}
//       cursor={cursor}
//       ref={mapRef}
//       attributionControl={false}
//     >
//       <NavigationControl position="bottom-left" showCompass={false} />
//       {children}

//       {segment !== "mobile" && (
//         <NetworkCoverageLayer layer={networkLayers.iot} />
//       )}

//       {selectedHex && (
//         <Source type="geojson" data={selectedHex.geojson}>
//           <Layer type="line" paint={getHexOutlineStyle(resolvedTheme)} />
//         </Source>
//       )}
//     </Map>
//   )
// }
