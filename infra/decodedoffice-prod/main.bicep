@description('Primary deployment location')
param location string = resourceGroup().location

@description('App Service plan name')
param appServicePlanName string = 'beamlab-prod-plan'

@description('Node app name')
param nodeAppName string = 'beamlab-backend-node-prod'

@description('Python app name')
param pythonAppName string = 'beamlab-backend-python-prod'

@description('Rust app name')
param rustAppName string = 'beamlab-rust-api-prod'

@description('Static Web App name')
param staticWebAppName string = 'beamlab-frontend-prod'

@description('Cosmos Mongo account name (globally unique)')
param cosmosAccountName string

@description('Redis cache name (globally unique)')
param redisName string

@description('Container Registry name (globally unique, alphanumeric)')
param acrName string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: 2
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource nodeApp 'Microsoft.Web/sites@2023-12-01' = {
  name: nodeAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      http20Enabled: true
      healthCheckPath: '/health'
      minTlsVersion: '1.2'
    }
  }
}

resource pythonApp 'Microsoft.Web/sites@2023-12-01' = {
  name: pythonAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      alwaysOn: true
      http20Enabled: true
      healthCheckPath: '/health'
      minTlsVersion: '1.2'
    }
  }
}

resource rustApp 'Microsoft.Web/sites@2023-12-01' = {
  name: rustAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|mcr.microsoft.com/azuredocs/aci-helloworld'
      alwaysOn: true
      http20Enabled: true
      healthCheckPath: '/health'
      minTlsVersion: '1.2'
    }
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: 'eastasia'
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    enableFreeTier: false
    publicNetworkAccess: 'Enabled'
    disableKeyBasedMetadataWriteAccess: true
  }
}

resource redis 'Microsoft.Cache/Redis@2024-03-01' = {
  name: redisName
  location: location
  properties: {
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
  sku: {
    name: 'Standard'
    family: 'C'
    capacity: 1
  }
}

output nodeHost string = nodeApp.properties.defaultHostName
output pythonHost string = pythonApp.properties.defaultHostName
output rustHost string = rustApp.properties.defaultHostName
output staticHost string = staticWebApp.properties.defaultHostname
output acrLoginServer string = acr.properties.loginServer
