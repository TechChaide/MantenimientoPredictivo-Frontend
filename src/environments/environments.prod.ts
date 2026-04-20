
export const environment = {
    ambiente: process.env.NEXT_PUBLIC_AMBIENT || 'prod',
    production: false,
    nombreAplicacion: "APP_MANETENIMIENTO_PREDICTIVO",

    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

    apiURL : 'https://apps.chaide.com/machineMaintenance',
    //apiURL: 'http://localhost:5400',

    apiUsuariosURL: 'https://apps.chaide.com/AServiceUth2',
    /////////////////////////////////////////Api Seguridades
    //apiMenuURL : 'http://localhost:5401', 
    apiMenuURL : 'https://apps.chaide.com/seguridades',


    tituloSistema: 'SISTEMA INTEGRADO DE PRODUCTIVIDAD OPERACIONAL (SIPO)',
};
