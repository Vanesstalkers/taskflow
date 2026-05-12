({
  access: 'public',
  /**
   * Универсальная выдача справочника из domain/list/<name> (поле items — массив записей).
   * @param {{ name: string }} params — имя файла в domain/list без пути (например taskTypes).
   */
  method: async ({ name }) => {
    if (typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Parameter "name" must be a valid list identifier');
    }
    const list = domain.lst[name];
    if (!list || !Array.isArray(list.items)) {
      throw new Error(`Unknown list: ${name}`);
    }
    return { items: list.items };
  },
});
