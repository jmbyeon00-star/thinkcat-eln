# ~/utils/collate.py
from typing import Dict
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import PreTrainedTokenizerBase
import pandas as pd

class FrameDataset(Dataset):
    def __init__(self, df: pd.DataFrame):
        # df: columns ['source', 'target']
        self.df = df.reset_index(drop=True)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        row = self.df.iloc[i]
        return row['source'], int(row['target'])


def build_dataloaders(
    df_train: pd.DataFrame, df_valid: pd.DataFrame,
    tokenizer: PreTrainedTokenizerBase, max_length: int,
    batch_size: int, shuffle: bool
) -> Dict[str, DataLoader]:

    def collate(batch):
        texts, labels = zip(*batch)

        encodings = [
            tokenizer(
                t,
                padding="max_length",
                truncation=True,
                max_length=max_length
            )
            for t in texts
        ]

        input_ids = torch.tensor([e["input_ids"] for e in encodings], dtype=torch.long)
        attention_mask = torch.tensor([e["attention_mask"] for e in encodings], dtype=torch.long)
        labels = torch.tensor(labels, dtype=torch.long)

        return {"input_ids": input_ids, "attention_mask": attention_mask}, labels

    loaders = {
        "train": DataLoader(FrameDataset(df_train), batch_size=batch_size, shuffle=shuffle, collate_fn=collate),
        "valid": DataLoader(FrameDataset(df_valid), batch_size=batch_size, shuffle=False, collate_fn=collate),
    }
    return loaders
