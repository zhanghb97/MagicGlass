export function makeMockObservations() {
  const now = Date.now();
  return [
    {
      id: 'mock-study', timestamp: now - 8 * 60000, scene: '书房', placeHint: '靠窗的书桌', summary: '桌面有耳机和充电器', location: null,
      items: [
        { name: '耳机', aliases: ['无线耳机'], description: '黑色耳机', relativeLocation: '显示器右侧', confidence: 0.94 },
        { name: '充电器', aliases: ['充电头'], description: '白色充电器', relativeLocation: '键盘后方', confidence: 0.91 },
      ],
    },
    {
      id: 'mock-living', timestamp: now - 5 * 60000, scene: '客厅', placeHint: '茶几', summary: '茶几上有遥控器和手机', location: null,
      items: [
        { name: '遥控器', aliases: ['电视遥控器'], description: '黑色遥控器', relativeLocation: '茶几左侧', confidence: 0.96 },
        { name: '手机', aliases: ['电话'], description: '深色手机', relativeLocation: '遥控器旁边', confidence: 0.9 },
      ],
    },
    {
      id: 'mock-entry', timestamp: now - 2 * 60000, scene: '玄关', placeHint: '鞋柜', summary: '鞋柜上有钥匙和钱包', location: null,
      items: [
        { name: '钥匙', aliases: ['钥匙串', '车钥匙'], description: '银色钥匙串', relativeLocation: '鞋柜顶部靠近门的一侧', confidence: 0.97 },
        { name: '钱包', aliases: ['钱夹'], description: '深色钱包', relativeLocation: '钥匙右侧', confidence: 0.93 },
      ],
    },
  ];
}

