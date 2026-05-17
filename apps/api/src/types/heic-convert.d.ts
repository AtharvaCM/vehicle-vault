declare module 'heic-convert' {
  type ConvertOptions = {
    buffer: Buffer;
    format: 'JPEG' | 'PNG';
    quality?: number;
  };

  type ConvertibleImage = {
    convert: () => Promise<ArrayBuffer | Buffer | Uint8Array>;
  };

  type Convert = {
    (options: ConvertOptions): Promise<ArrayBuffer | Buffer | Uint8Array>;
    all: (options: ConvertOptions) => Promise<ConvertibleImage[]>;
  };

  const convert: Convert;
  export = convert;
}
