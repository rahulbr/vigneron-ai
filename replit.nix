{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x >= 18.17.0
    pkgs.nodePackages.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
  ];
}