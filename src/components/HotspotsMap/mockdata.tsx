interface Drone {
  id: string
  lat: number
  lng: number
  status: string
  concentration: number
}

const generateMockDrones = (numDrones: number): Drone[] => {
  const drones: Drone[] = [] // Explicitly set the type of drones array

  for (let i = 0; i < numDrones; i++) {
    const lat = Math.random() * 180 - 90 // Random latitude between -90 and 90
    const lng = Math.random() * 360 - 180 // Random longitude between -180 and 180
    const status = Math.random() < 0.9 ? "active" : "inactive" // Random status
    const concentration =
      status === "active" ? Math.random() * 0.5 + 0.5 : Math.random() // Concentration logic

    // Push a properly typed object into the array
    drones.push({
      id: `drone-${i + 1}`,
      lat,
      lng,
      status,
      concentration: parseFloat(concentration.toFixed(2)), // Round to 2 decimal places
    })
  }

  return drones
}

// Generate mock data for 100 drones (adjust the number as needed)
export const mockDroneRadars: Drone[] = generateMockDrones(100) // Type the mock data array explicitly
