export interface Profile {
  idProfile?: string;
  name?: string;
  providers?: Provider[]
}

export interface Provider {
  idService?: string;
  name?: string;
}
