/**
 * Custom Node-RED Settings
 * Auto-configured for Customer Support Agent with Cloudflare AutoRAG
 * Enhanced with customer profile management and conversation history
 */

module.exports = {
    // Flow file path (using our custom created flow)
    flowFile: 'flows-updated.json',
    
    // Configure user directory
    userDir: '/Users/krempovych/.node-red/',
    
    // Node modules to load
    nodesDir: [
        '/Users/krempovych/Workspaces/Customer Support/nodes'
    ],
    
    // Node-RED port (using alternate port to avoid conflicts)
    uiPort: process.env.PORT || 1883,
    
    // Security - set a credential secret for better security
    credentialSecret: "customer-support-agent-secret",
    
    // Dashboard configuration
    ui: { path: "ui" },
    
    // Logging settings
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },
    
    // Additional settings for function nodes
    functionGlobalContext: {
        // Expose additional modules that can be used in function nodes
        os:require('os'),
        fs:require('fs'),
        path:require('path'),
        customerDb:require('./customer-db')
    },
    
    // Configure node types that are enabled
    nodesExcludes: [
        // Exclude any node types you don't want to use
    ],
    
    // Allow the Function, Template and Dashboard UI nodes
    functionExternalModules: true,
    
    // Enable projects feature (optional - set to true if you want to use projects)
    editorTheme: {
        projects: {
            enabled: false
        }
    }
};
