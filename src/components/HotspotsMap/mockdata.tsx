const generateMockDrones = (numDrones: number) => {
  const drones = []

  for (let i = 0; i < numDrones; i++) {
    const lat = Math.random() * 180 - 90 // Random latitude between -90 and 90
    const lng = Math.random() * 360 - 180 // Random longitude between -180 and 180
    const status = Math.random() > 0.5 ? "active" : "inactive" // Random status
    const concentration = Math.random() // Random concentration between 0 and 1

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
export const mockDroneRadars = generateMockDrones(100)
