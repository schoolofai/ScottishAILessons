{ pkgs }: {
  deps = [
    # Node.js 22.x runtime for Next.js 15
    pkgs.nodejs-22_x

    # TypeScript language server for IDE support
    pkgs.typescript-language-server

    # TypeScript compiler
    pkgs.nodePackages.typescript
  ];
}
