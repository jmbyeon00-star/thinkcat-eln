# gpu_backend/tasks/train_task.py
import torch
from torch.utils.data import DataLoader, TensorDataset

def run_training(project_id, params):
    print(f"[Worker] Start training project {project_id} with params={params}")

    # 예시 데이터 (랜덤)
    x = torch.randn(100, 10)
    y = torch.randint(0, 2, (100,))
    dataset = TensorDataset(x, y)
    dataloader = DataLoader(dataset, batch_size=params.get("batch_size", 32))

    # 간단한 모델
    model = torch.nn.Sequential(
        torch.nn.Linear(10, 32),
        torch.nn.ReLU(),
        torch.nn.Linear(32, 2)
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=params.get("learning_rate", 0.001))
    criterion = torch.nn.CrossEntropyLoss()

    for epoch in range(params.get("epoch", 5)):
        total_loss = 0
        for batch_x, batch_y in dataloader:
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"[Epoch {epoch+1}] Loss={total_loss:.4f}")

    torch.save(model.state_dict(), f"checkpoints/project_{project_id}.pt")
    print(f"[Worker] Finished training project {project_id}")
