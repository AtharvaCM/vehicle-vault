export default () => ({
  app: {
    name: 'vehicle-vault-api',
    port: Number(process.env.PORT ?? 3001),
  },
});
