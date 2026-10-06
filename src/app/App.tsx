import { useEffect, useRef, useState } from 'react';

// Types
interface Vector2 {
  x: number;
  y: number;
}

interface GameObject {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
}

interface Player extends GameObject {
  health: number;
  maxHealth: number;
  weapon: Weapon;
  speed: number;
  isSprinting: boolean;
  ammo: number;
  maxAmmo: number;
}

interface Enemy extends GameObject {
  health: number;
  maxHealth: number;
  speed: number;
  state: 'patrol' | 'chase' | 'attack' | 'cover';
  patrolTarget: Vector2;
  lastShot: number;
  type: 'soldier' | 'heavy' | 'sniper';
}

interface Bullet {
  position: Vector2;
  velocity: Vector2;
  damage: number;
  owner: 'player' | 'enemy';
  size: number;
}

interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'blood' | 'smoke' | 'explosion' | 'spark';
}

interface Weapon {
  name: string;
  damage: number;
  fireRate: number;
  recoil: number;
  bulletSpeed: number;
  spread: number;
}

interface Obstacle {
  position: Vector2;
  width: number;
  height: number;
  type: 'building' | 'vehicle' | 'barricade' | 'crate';
}

const WEAPONS: { [key: string]: Weapon } = {
  rifle: {
    name: 'Assault Rifle',
    damage: 25,
    fireRate: 150,
    recoil: 0.1,
    bulletSpeed: 15,
    spread: 0.05,
  },
  shotgun: {
    name: 'Shotgun',
    damage: 15,
    fireRate: 600,
    recoil: 0.3,
    bulletSpeed: 12,
    spread: 0.2,
  },
  sniper: {
    name: 'Sniper Rifle',
    damage: 80,
    fireRate: 1000,
    recoil: 0.5,
    bulletSpeed: 25,
    spread: 0.01,
  },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory' | 'defeat'>('menu');
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Game dimensions
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 800;
    const MAP_WIDTH = 2400;
    const MAP_HEIGHT = 1600;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Camera
    const camera = { x: 0, y: 0 };

    // Input state
    const keys: { [key: string]: boolean } = {};
    const mouse = { x: 0, y: 0, down: false };

    // Player
    const player: Player = {
      position: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      size: 20,
      health: 100,
      maxHealth: 100,
      weapon: WEAPONS.rifle,
      speed: 3,
      isSprinting: false,
      ammo: 30,
      maxAmmo: 30,
    };

    // Game objects
    const enemies: Enemy[] = [];
    const bullets: Bullet[] = [];
    const particles: Particle[] = [];
    const obstacles: Obstacle[] = [];

    // Game state
    let lastShot = 0;
    let lastEnemySpawn = 0;
    let enemiesAlive = 0;
    let currentKills = 0;
    let currentScore = 0;
    let currentWave = 1;

    // Generate obstacles
    const generateObstacles = () => {
      const types: Array<'building' | 'vehicle' | 'barricade' | 'crate'> = ['building', 'vehicle', 'barricade', 'crate'];

      for (let i = 0; i < 30; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        let width, height;

        switch (type) {
          case 'building':
            width = 100 + Math.random() * 100;
            height = 100 + Math.random() * 100;
            break;
          case 'vehicle':
            width = 60 + Math.random() * 40;
            height = 40 + Math.random() * 30;
            break;
          case 'barricade':
            width = 80 + Math.random() * 40;
            height = 20 + Math.random() * 10;
            break;
          case 'crate':
            width = 30 + Math.random() * 20;
            height = 30 + Math.random() * 20;
            break;
        }

        obstacles.push({
          position: {
            x: Math.random() * (MAP_WIDTH - width),
            y: Math.random() * (MAP_HEIGHT - height),
          },
          width,
          height,
          type,
        });
      }
    };

    generateObstacles();

    // Spawn enemy
    const spawnEnemy = () => {
      const types: Array<'soldier' | 'heavy' | 'sniper'> = ['soldier', 'soldier', 'heavy', 'sniper'];
      const type = types[Math.floor(Math.random() * types.length)];

      let health, speed, size;
      switch (type) {
        case 'soldier':
          health = 50;
          speed = 2;
          size = 18;
          break;
        case 'heavy':
          health = 100;
          speed = 1.5;
          size = 24;
          break;
        case 'sniper':
          health = 30;
          speed = 2.5;
          size = 16;
          break;
      }

      const angle = Math.random() * Math.PI * 2;
      const distance = 600;

      enemies.push({
        position: {
          x: player.position.x + Math.cos(angle) * distance,
          y: player.position.y + Math.sin(angle) * distance,
        },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        size,
        health,
        maxHealth: health,
        speed,
        state: 'patrol',
        patrolTarget: {
          x: Math.random() * MAP_WIDTH,
          y: Math.random() * MAP_HEIGHT,
        },
        lastShot: 0,
        type,
      });

      enemiesAlive++;
    };

    // Create particles
    const createParticles = (
      position: Vector2,
      count: number,
      type: 'blood' | 'smoke' | 'explosion' | 'spark',
      color?: string
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = type === 'explosion' ? 5 + Math.random() * 5 : 2 + Math.random() * 3;

        particles.push({
          position: { ...position },
          velocity: {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
          },
          life: 1,
          maxLife: 1,
          size: type === 'explosion' ? 8 + Math.random() * 8 : 3 + Math.random() * 5,
          color: color || (type === 'blood' ? '#ff0000' : type === 'explosion' ? '#ff6600' : '#888888'),
          type,
        });
      }
    };

    // Check collision with obstacles
    const checkObstacleCollision = (pos: Vector2, size: number): boolean => {
      for (const obstacle of obstacles) {
        if (
          pos.x + size > obstacle.position.x &&
          pos.x - size < obstacle.position.x + obstacle.width &&
          pos.y + size > obstacle.position.y &&
          pos.y - size < obstacle.position.y + obstacle.height
        ) {
          return true;
        }
      }
      return false;
    };

    // Find cover
    const findNearestCover = (pos: Vector2): Vector2 | null => {
      let nearestDistance = Infinity;
      let nearestCover: Vector2 | null = null;

      for (const obstacle of obstacles) {
        const centerX = obstacle.position.x + obstacle.width / 2;
        const centerY = obstacle.position.y + obstacle.height / 2;
        const distance = Math.hypot(centerX - pos.x, centerY - pos.y);

        if (distance < nearestDistance && distance < 300) {
          nearestDistance = distance;
          nearestCover = { x: centerX, y: centerY };
        }
      }

      return nearestCover;
    };

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;

      if (e.key === '1') player.weapon = WEAPONS.rifle;
      if (e.key === '2') player.weapon = WEAPONS.shotgun;
      if (e.key === '3') player.weapon = WEAPONS.sniper;
      if (e.key === 'r') player.ammo = player.maxAmmo;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseDown = () => {
      mouse.down = true;
    };

    const handleMouseUp = () => {
      mouse.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Game loop
    let animationId: number;
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 16.67, 2);
      lastTime = currentTime;

      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Update camera
      camera.x = player.position.x - CANVAS_WIDTH / 2;
      camera.y = player.position.y - CANVAS_HEIGHT / 2;
      camera.x = Math.max(0, Math.min(camera.x, MAP_WIDTH - CANVAS_WIDTH));
      camera.y = Math.max(0, Math.min(camera.y, MAP_HEIGHT - CANVAS_HEIGHT));

      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      // Draw grid
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < MAP_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < MAP_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Draw obstacles
      obstacles.forEach(obstacle => {
        ctx.save();
        ctx.translate(obstacle.position.x, obstacle.position.y);

        switch (obstacle.type) {
          case 'building':
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 0, obstacle.width, obstacle.height);
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, obstacle.width, obstacle.height);
            // Windows
            for (let i = 10; i < obstacle.width - 20; i += 30) {
              for (let j = 10; j < obstacle.height - 20; j += 30) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(i, j, 15, 15);
              }
            }
            break;
          case 'vehicle':
            ctx.fillStyle = '#4a5a4a';
            ctx.fillRect(0, 0, obstacle.width, obstacle.height);
            ctx.fillStyle = '#2a3a2a';
            ctx.fillRect(obstacle.width * 0.2, 0, obstacle.width * 0.6, obstacle.height * 0.4);
            break;
          case 'barricade':
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(0, 0, obstacle.width, obstacle.height);
            ctx.strokeStyle = '#3a2a1a';
            ctx.lineWidth = 3;
            for (let i = 0; i < obstacle.width; i += 15) {
              ctx.beginPath();
              ctx.moveTo(i, 0);
              ctx.lineTo(i, obstacle.height);
              ctx.stroke();
            }
            break;
          case 'crate':
            ctx.fillStyle = '#6a5a4a';
            ctx.fillRect(0, 0, obstacle.width, obstacle.height);
            ctx.strokeStyle = '#4a3a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, obstacle.width, obstacle.height);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(obstacle.width, obstacle.height);
            ctx.moveTo(obstacle.width, 0);
            ctx.lineTo(0, obstacle.height);
            ctx.stroke();
            break;
        }

        ctx.restore();
      });

      // Player movement
      let dx = 0;
      let dy = 0;

      if (keys['w']) dy -= 1;
      if (keys['s']) dy += 1;
      if (keys['a']) dx -= 1;
      if (keys['d']) dx += 1;

      const magnitude = Math.hypot(dx, dy);
      if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
      }

      player.isSprinting = keys['shift'];
      const currentSpeed = player.speed * (player.isSprinting ? 1.5 : 1);

      const newX = player.position.x + dx * currentSpeed * deltaTime;
      const newY = player.position.y + dy * currentSpeed * deltaTime;

      if (!checkObstacleCollision({ x: newX, y: player.position.y }, player.size)) {
        player.position.x = Math.max(player.size, Math.min(newX, MAP_WIDTH - player.size));
      }
      if (!checkObstacleCollision({ x: player.position.x, y: newY }, player.size)) {
        player.position.y = Math.max(player.size, Math.min(newY, MAP_HEIGHT - player.size));
      }

      // Player rotation (aim at mouse)
      const worldMouseX = mouse.x + camera.x;
      const worldMouseY = mouse.y + camera.y;
      player.rotation = Math.atan2(worldMouseY - player.position.y, worldMouseX - player.position.x);

      // Player shooting
      if (mouse.down && currentTime - lastShot > player.weapon.fireRate && player.ammo > 0) {
        lastShot = currentTime;
        player.ammo--;

        const bulletsToFire = player.weapon.name === 'Shotgun' ? 5 : 1;

        for (let i = 0; i < bulletsToFire; i++) {
          const spread = (Math.random() - 0.5) * player.weapon.spread;
          const angle = player.rotation + spread;

          bullets.push({
            position: { ...player.position },
            velocity: {
              x: Math.cos(angle) * player.weapon.bulletSpeed,
              y: Math.sin(angle) * player.weapon.bulletSpeed,
            },
            damage: player.weapon.damage,
            owner: 'player',
            size: 3,
          });
        }

        createParticles(player.position, 3, 'spark', '#ffaa00');
      }

      // Update enemies
      enemies.forEach((enemy, index) => {
        const distanceToPlayer = Math.hypot(
          player.position.x - enemy.position.x,
          player.position.y - enemy.position.y
        );

        // AI behavior
        if (distanceToPlayer < 400) {
          if (distanceToPlayer > 200 && enemy.type !== 'sniper') {
            enemy.state = 'chase';
          } else if (distanceToPlayer < 150 && Math.random() < 0.3) {
            enemy.state = 'cover';
          } else {
            enemy.state = 'attack';
          }
        } else {
          enemy.state = 'patrol';
        }

        let targetX = enemy.position.x;
        let targetY = enemy.position.y;

        switch (enemy.state) {
          case 'patrol':
            if (Math.hypot(enemy.patrolTarget.x - enemy.position.x, enemy.patrolTarget.y - enemy.position.y) < 30) {
              enemy.patrolTarget = {
                x: Math.random() * MAP_WIDTH,
                y: Math.random() * MAP_HEIGHT,
              };
            }
            targetX = enemy.patrolTarget.x;
            targetY = enemy.patrolTarget.y;
            break;

          case 'chase':
            targetX = player.position.x;
            targetY = player.position.y;
            break;

          case 'cover':
            const cover = findNearestCover(enemy.position);
            if (cover) {
              targetX = cover.x;
              targetY = cover.y;
            }
            break;

          case 'attack':
            enemy.rotation = Math.atan2(player.position.y - enemy.position.y, player.position.x - enemy.position.x);

            const fireRate = enemy.type === 'heavy' ? 300 : enemy.type === 'sniper' ? 1500 : 500;

            if (currentTime - enemy.lastShot > fireRate) {
              enemy.lastShot = currentTime;

              const accuracy = enemy.type === 'sniper' ? 0.02 : 0.15;
              const spread = (Math.random() - 0.5) * accuracy;

              bullets.push({
                position: { ...enemy.position },
                velocity: {
                  x: Math.cos(enemy.rotation + spread) * 10,
                  y: Math.sin(enemy.rotation + spread) * 10,
                },
                damage: enemy.type === 'heavy' ? 15 : enemy.type === 'sniper' ? 50 : 10,
                owner: 'enemy',
                size: 3,
              });

              createParticles(enemy.position, 2, 'spark', '#ff6600');
            }
            break;
        }

        if (enemy.state !== 'attack') {
          const angle = Math.atan2(targetY - enemy.position.y, targetX - enemy.position.x);
          enemy.rotation = angle;

          const newEnemyX = enemy.position.x + Math.cos(angle) * enemy.speed * deltaTime;
          const newEnemyY = enemy.position.y + Math.sin(angle) * enemy.speed * deltaTime;

          if (!checkObstacleCollision({ x: newEnemyX, y: enemy.position.y }, enemy.size)) {
            enemy.position.x = newEnemyX;
          }
          if (!checkObstacleCollision({ x: enemy.position.x, y: newEnemyY }, enemy.size)) {
            enemy.position.y = newEnemyY;
          }
        }
      });

      // Update bullets
      bullets.forEach((bullet, index) => {
        bullet.position.x += bullet.velocity.x * deltaTime;
        bullet.position.y += bullet.velocity.y * deltaTime;

        // Check collision with obstacles
        if (checkObstacleCollision(bullet.position, bullet.size)) {
          bullets.splice(index, 1);
          createParticles(bullet.position, 5, 'spark', '#888888');
          return;
        }

        // Check collision with enemies
        if (bullet.owner === 'player') {
          enemies.forEach((enemy, enemyIndex) => {
            const distance = Math.hypot(bullet.position.x - enemy.position.x, bullet.position.y - enemy.position.y);
            if (distance < enemy.size + bullet.size) {
              enemy.health -= bullet.damage;
              bullets.splice(index, 1);
              createParticles(bullet.position, 8, 'blood');

              if (enemy.health <= 0) {
                enemies.splice(enemyIndex, 1);
                enemiesAlive--;
                currentKills++;
                currentScore += enemy.type === 'heavy' ? 150 : enemy.type === 'sniper' ? 200 : 100;
                createParticles(enemy.position, 20, 'explosion');
                setKills(currentKills);
                setScore(currentScore);
              }
            }
          });
        }

        // Check collision with player
        if (bullet.owner === 'enemy') {
          const distance = Math.hypot(bullet.position.x - player.position.x, bullet.position.y - player.position.y);
          if (distance < player.size + bullet.size) {
            player.health -= bullet.damage;
            bullets.splice(index, 1);
            createParticles(bullet.position, 6, 'blood');

            if (player.health <= 0) {
              setGameState('defeat');
            }
          }
        }

        // Remove bullets out of bounds
        if (
          bullet.position.x < 0 ||
          bullet.position.x > MAP_WIDTH ||
          bullet.position.y < 0 ||
          bullet.position.y > MAP_HEIGHT
        ) {
          bullets.splice(index, 1);
        }
      });

      // Update particles
      particles.forEach((particle, index) => {
        particle.position.x += particle.velocity.x * deltaTime;
        particle.position.y += particle.velocity.y * deltaTime;
        particle.velocity.x *= 0.95;
        particle.velocity.y *= 0.95;
        particle.life -= 0.02 * deltaTime;

        if (particle.life <= 0) {
          particles.splice(index, 1);
        }
      });

      // Spawn enemies
      const enemiesPerWave = 5 + currentWave * 2;
      if (currentTime - lastEnemySpawn > 2000 && enemiesAlive < enemiesPerWave) {
        lastEnemySpawn = currentTime;
        spawnEnemy();
      }

      // Check wave completion
      if (currentKills >= enemiesPerWave && enemiesAlive === 0) {
        currentWave++;
        currentKills = 0;
        setWave(currentWave);
        player.health = Math.min(player.maxHealth, player.health + 30);
        player.ammo = player.maxAmmo;
      }

      // Draw particles
      particles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw bullets
      bullets.forEach(bullet => {
        ctx.fillStyle = bullet.owner === 'player' ? '#ffff00' : '#ff3300';
        ctx.beginPath();
        ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();

        // Bullet trail
        ctx.strokeStyle = bullet.owner === 'player' ? '#ffff0040' : '#ff330040';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bullet.position.x, bullet.position.y);
        ctx.lineTo(
          bullet.position.x - bullet.velocity.x * 3,
          bullet.position.y - bullet.velocity.y * 3
        );
        ctx.stroke();
      });

      // Draw enemies
      enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.position.x, enemy.position.y);
        ctx.rotate(enemy.rotation);

        // Enemy body
        let color;
        switch (enemy.type) {
          case 'soldier':
            color = '#ff3333';
            break;
          case 'heavy':
            color = '#993333';
            break;
          case 'sniper':
            color = '#ff6666';
            break;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Weapon
        ctx.fillStyle = '#333333';
        const weaponLength = enemy.type === 'sniper' ? 25 : enemy.type === 'heavy' ? 20 : 18;
        ctx.fillRect(enemy.size - 5, -3, weaponLength, 6);

        // Direction indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(enemy.size, 0);
        ctx.lineTo(enemy.size - 8, -5);
        ctx.lineTo(enemy.size - 8, 5);
        ctx.fill();

        ctx.restore();

        // Health bar
        const barWidth = 40;
        const barHeight = 6;
        ctx.fillStyle = '#333333';
        ctx.fillRect(enemy.position.x - barWidth / 2, enemy.position.y - enemy.size - 15, barWidth, barHeight);
        ctx.fillStyle = '#ff0000';
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillRect(enemy.position.x - barWidth / 2, enemy.position.y - enemy.size - 15, barWidth * healthPercent, barHeight);
      });

      // Draw player
      ctx.save();
      ctx.translate(player.position.x, player.position.y);
      ctx.rotate(player.rotation);

      // Player body
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(0, 0, player.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Weapon
      ctx.fillStyle = '#333333';
      const playerWeaponLength = player.weapon.name === 'Sniper Rifle' ? 30 : 20;
      ctx.fillRect(player.size - 5, -4, playerWeaponLength, 8);

      // Direction indicator
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(player.size, 0);
      ctx.lineTo(player.size - 10, -6);
      ctx.lineTo(player.size - 10, 6);
      ctx.fill();

      ctx.restore();

      ctx.restore();

      // Draw HUD
      // Health bar
      ctx.fillStyle = '#00000080';
      ctx.fillRect(20, 20, 250, 40);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(30, 30, 230 * (player.health / player.maxHealth), 20);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 230, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`HP: ${Math.max(0, Math.floor(player.health))}/${player.maxHealth}`, 35, 45);

      // Ammo
      ctx.fillStyle = '#00000080';
      ctx.fillRect(20, 70, 150, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`AMMO: ${player.ammo}/${player.maxAmmo}`, 30, 92);

      // Weapon
      ctx.fillStyle = '#00000080';
      ctx.fillRect(20, 110, 200, 30);
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(player.weapon.name.toUpperCase(), 30, 132);

      // Score and kills
      ctx.fillStyle = '#00000080';
      ctx.fillRect(CANVAS_WIDTH - 220, 20, 200, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`SCORE: ${currentScore}`, CANVAS_WIDTH - 210, 45);
      ctx.fillText(`KILLS: ${currentKills}`, CANVAS_WIDTH - 210, 70);
      ctx.fillText(`WAVE: ${currentWave}`, CANVAS_WIDTH - 210, 95);

      // Minimap
      const minimapSize = 150;
      const minimapScale = minimapSize / MAP_WIDTH;
      ctx.fillStyle = '#00000080';
      ctx.fillRect(CANVAS_WIDTH - minimapSize - 20, CANVAS_HEIGHT - minimapSize - 20, minimapSize, minimapSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(CANVAS_WIDTH - minimapSize - 20, CANVAS_HEIGHT - minimapSize - 20, minimapSize, minimapSize);

      // Minimap obstacles
      ctx.fillStyle = '#555555';
      obstacles.forEach(obs => {
        ctx.fillRect(
          CANVAS_WIDTH - minimapSize - 20 + obs.position.x * minimapScale,
          CANVAS_HEIGHT - minimapSize - 20 + obs.position.y * minimapScale,
          obs.width * minimapScale,
          obs.height * minimapScale
        );
      });

      // Minimap player
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(
        CANVAS_WIDTH - minimapSize - 20 + player.position.x * minimapScale,
        CANVAS_HEIGHT - minimapSize - 20 + player.position.y * minimapScale,
        4,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Minimap enemies
      ctx.fillStyle = '#ff0000';
      enemies.forEach(enemy => {
        ctx.beginPath();
        ctx.arc(
          CANVAS_WIDTH - minimapSize - 20 + enemy.position.x * minimapScale,
          CANVAS_HEIGHT - minimapSize - 20 + enemy.position.y * minimapScale,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      // Weapon select hint
      ctx.fillStyle = '#ffffff40';
      ctx.font = '12px Arial';
      ctx.fillText('Press 1/2/3 to change weapon | R to reload', 20, CANVAS_HEIGHT - 20);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setKills(0);
    setWave(1);
  };

  if (gameState === 'menu') {
    return (
      <div className="size-full bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-8">
          <h1 className="text-7xl font-bold text-white mb-4 drop-shadow-lg">
            COMBAT ZONE
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Eliminate enemy squads, survive waves of attacks, and dominate the battlefield
          </p>
          <div className="space-y-4">
            <button
              onClick={startGame}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-2xl px-12 py-4 rounded-lg transition-all transform hover:scale-105 shadow-2xl"
            >
              START MISSION
            </button>
            <div className="text-gray-400 space-y-2">
              <p>WASD - Move | Mouse - Aim & Shoot</p>
              <p>Shift - Sprint | 1/2/3 - Change Weapon | R - Reload</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'defeat') {
    return (
      <div className="size-full bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center">
        <div className="text-center space-y-8">
          <h1 className="text-7xl font-bold text-red-500 mb-4 drop-shadow-lg">
            MISSION FAILED
          </h1>
          <div className="space-y-4">
            <p className="text-3xl text-white">Final Score: {score}</p>
            <p className="text-2xl text-gray-300">Enemies Eliminated: {kills}</p>
            <p className="text-2xl text-gray-300">Waves Survived: {wave}</p>
          </div>
          <button
            onClick={startGame}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xl px-10 py-3 rounded-lg transition-all transform hover:scale-105 shadow-2xl"
          >
            RETRY MISSION
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'victory') {
    return (
      <div className="size-full bg-gradient-to-br from-gray-900 via-green-900 to-black flex items-center justify-center">
        <div className="text-center space-y-8">
          <h1 className="text-7xl font-bold text-green-500 mb-4 drop-shadow-lg">
            VICTORY!
          </h1>
          <div className="space-y-4">
            <p className="text-3xl text-white">Final Score: {score}</p>
            <p className="text-2xl text-gray-300">Enemies Eliminated: {kills}</p>
            <p className="text-2xl text-gray-300">Waves Completed: {wave}</p>
          </div>
          <button
            onClick={startGame}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xl px-10 py-3 rounded-lg transition-all transform hover:scale-105 shadow-2xl"
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="border-4 border-gray-800 shadow-2xl"
      />
    </div>
  );
}
